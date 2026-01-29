const { gmail } = require('../config/gmail');
const EmailController = require('../controllers/emailController');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class GmailFetcher {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async fetchUnreadEmails() {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread category:primary newer_than:1d',
      maxResults: 10 // Smaller batches to handle large backlogs safely
    });

    if (!res.data.messages || res.data.messages.length === 0) {
      logger.info('No unread emails found in the last 24 hours.');
      return;
    }

    logger.info(`Found ${res.data.messages.length} unread emails. Processing...`);

    for (const msg of res.data.messages) {
      await this.processMessage(msg.id);
      // Increased delay to stay safely within 15 RPM limit (60/4.5 = 13.3)
      await new Promise(resolve => setTimeout(resolve, 4500));
    }
  }

  async processMessage(messageId) {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: messageId
    });

    const internalDate = new Date(parseInt(msg.data.internalDate));
    const headers = msg.data.payload.headers;
    const getHeader = name =>
      headers.find(h => h.name === name)?.value;

    // 1. Extract Body & Attachments info
    const attachments = [];
    const bodyInfo = this.parsePart(msg.data.payload, messageId, attachments);

    const emailData = {
      from: getHeader('From'),
      to: getHeader('To')?.split(','),
      subject: getHeader('Subject'),
      body: bodyInfo.text || bodyInfo.html.replace(/<[^>]*>?/gm, ''),
      htmlBody: bodyInfo.html,
      receivedAt: internalDate // Use real Gmail timestamp
    };

    // 2. Download attachments to local 'uploads'
    const files = [];
    for (const attInfo of attachments) {
      try {
        const attRes = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: messageId,
          id: attInfo.attachmentId
        });

        const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${attInfo.filename}`;
        const filePath = path.join(this.uploadsDir, filename);
        const buffer = Buffer.from(attRes.data.data, 'base64');
        
        fs.writeFileSync(filePath, buffer);
        
        files.push({
          fieldname: 'attachments',
          originalname: attInfo.filename,
          filename: filename,
          path: filePath,
          mimetype: attInfo.mimeType,
          size: buffer.length
        });
      } catch (err) {
        console.error(`❌ Failed to download attachment ${attInfo.filename}`, err);
      }
    }

    try {
      await EmailController.processEmailAsync(emailData, `gmail_${messageId}`, files);
    } catch (err) {
      if (err.code === 11000 || err.message.includes('E11000')) {
        logger.warn(`📩 Email gmail_${messageId} already exists, skipping.`, { messageId });
        // Cleanup local files if we skip
        files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
      } else {
        logger.error(`❌ Non-recoverable error processing email ${messageId}. Marking as read to prevent loop.`, { error: err.message });
        // We still continue to mark as read so we don't loop forever.
        // The email is likely already saved in DB or will be on next try.
      }
    }

    // Mark as read
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] }
    });
  }

  parsePart(part, messageId, attachments) {
    let text = '';
    let html = '';

    if (part.filename && part.body.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType,
        attachmentId: part.body.attachmentId
      });
    }

    if (part.mimeType === 'text/plain' && part.body.data) {
      text = Buffer.from(part.body.data, 'base64').toString();
    } else if (part.mimeType === 'text/html' && part.body.data) {
      html = Buffer.from(part.body.data, 'base64').toString();
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        const subResult = this.parsePart(subPart, messageId, attachments);
        text += subResult.text;
        html += subResult.html;
      }
    }

    return { text, html };
  }
}

module.exports = new GmailFetcher();
