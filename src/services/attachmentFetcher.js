const Attachment = require('../models/Attachment');
const cloudinary = require('../config/cloudinary');
const logger = require('../utils/logger');
const textExtractor = require('./textExtractor');
const fs = require('fs').promises;

class AttachmentFetcher {
  async processAttachment(file, emailTrackingId) {
    const attachmentId = `att_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const attachment = new Attachment({
      attachmentId,
      emailTrackingId,
      filename: file.filename,
      originalName: file.originalname,
      contentType: file.mimetype,
      size: file.size,
      processingStatus: 'pending'
    });

    await attachment.save();

    try {
      // ✅ 1. Extract text LOCALLY
      const extracted = await textExtractor.extractFromLocalFile(
        file.path,
        file.mimetype
      );

      attachment.extractedText = extracted.text;
      attachment.extractionMethod = extracted.method;
      await attachment.updateStatus('extracting');

      // ✅ 2. Upload to Cloudinary
      await attachment.updateStatus('uploading');

      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'email-attachments',
        resource_type: 'auto',
        public_id: attachmentId
      });

      attachment.cloudStorageUrl = result.secure_url;
      attachment.cloudPublicId = result.public_id;
      await attachment.updateStatus('completed');

      // ✅ 3. Delete local file
      await fs.unlink(file.path);

      logger.info('Attachment processed successfully', { attachmentId });

      return attachment;

    } catch (err) {
      logger.error('Attachment processing failed', {
        attachmentId,
        error: err.message
      });

      attachment.errorLogs.push({
        stage: 'processing',
        message: err.message,
        timestamp: new Date()
      });

      await attachment.updateStatus('failed');
      throw err;
    }
  }

  async processAttachments(files, emailTrackingId) {
    const results = [];
    for (const file of files) {
      results.push(await this.processAttachment(file, emailTrackingId));
    }
    return results;
  }
}

module.exports = new AttachmentFetcher();
