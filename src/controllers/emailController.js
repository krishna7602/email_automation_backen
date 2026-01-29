const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const emailParser = require('../services/emailParser');
const Email = require('../models/Email');
const attachmentFetcher = require('../services/attachmentFetcher');
const aiService = require('../services/aiService');
const Order = require('../models/Order');
const salesforceService = require('../services/salesforceService');

class EmailController {
  constructor() {
    this.receiveEmail = this.receiveEmail.bind(this);
    this.processEmailAsync = this.processEmailAsync.bind(this);
    this.getStats = this.getStats.bind(this);
    this.getAllEmails = this.getAllEmails.bind(this);
    this.getEmailByTrackingId = this.getEmailByTrackingId.bind(this);
    this.deleteEmail = this.deleteEmail.bind(this);
    this.reprocessEmail = this.reprocessEmail.bind(this);
    this.convertToOrderManually = this.convertToOrderManually.bind(this);
    this._attemptOrderExtraction = this._attemptOrderExtraction.bind(this);
  }
  async receiveEmail(req, res) {
    try {
      logger.info('Email webhook received');
      
      const { from, subject } = req.body;
      if (!from || !subject) {
        return errorResponse(res, 'Missing required fields: from, subject', 400);
      }

      const trackingId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      logger.info('Email accepted for processing', { trackingId, from, subject });

      const response = successResponse(
        res,
        {
          trackingId,
          status: 'accepted',
          message: 'Email accepted for processing'
        },
        'Email received successfully',
        200
      );

      setImmediate(() => {
        module.exports.processEmailAsync(req.body, trackingId, req.files)
          .catch(error => {
            logger.error('Async processing failed:', { trackingId, error: error.message });
          });
      });

      return response;

    } catch (error) {
      logger.error('Error in webhook handler:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  
async processEmailAsync(emailData, trackingId, files = []) {
  try {
    logger.info('Starting async processing', { trackingId });

    // 1. Parse email
    const analysis = emailParser.analyzeContent(emailData.body || '');
    const senderName = emailParser.extractSenderName(emailData.from);
    const priority = emailParser.determinePriority(
      emailData.subject,
      emailData.body || ''
    );

    // 2. checking email existing or Persist email
    let email = await Email.findOne({ trackingId });
    if (!email) {
      email = new Email({
        trackingId,
        from: emailData.from,
        to: Array.isArray(emailData.to) ? emailData.to : [emailData.to],
        cc: emailData.cc || [],
        subject: emailData.subject,
        body: emailData.body || '',
        htmlBody: emailData.htmlBody || '',
        senderName,
        priority,
        analysis,
        receivedAt: emailData.receivedAt || new Date(),
        hasAttachments: Array.isArray(files) && files.length > 0,
        attachmentCount: Array.isArray(files) ? files.length : 0,
        attachmentsProcessed: 0,
        processingStatus: 'parsing'
      });
      await email.save();
    }
    logger.info('Email saved or retrieved', { trackingId, id: email._id });

    // 3. Parsed successfully
    await email.updateStatus('parsed');

    // 4. No attachments → finish
    if (!Array.isArray(files) || files.length === 0) {
      // Attempt AI extraction
      await this._attemptOrderExtraction(email);
      await email.updateStatus('completed');
      logger.info('Processing completed (no attachments)', { trackingId });
      return email;
    }

    // 5. Attachments exist → async background processing
    await email.updateStatus('processing_attachments');

    setImmediate(() => {
      (async () => {
        try {
          logger.info('Processing attachments', {
            trackingId,
            count: files.length
          });

          const attachments =
            await attachmentFetcher.processAttachments(files, trackingId);

          email.attachmentsProcessed = attachments.length;
          email.attachments = attachments;
          email.attachmentsProcessed = attachments.length;
          email.attachments = attachments;
          
          // Attempt AI extraction with attachments
          await this._attemptOrderExtraction(email);
          
          await email.updateStatus('completed');
          await email.save();

          logger.info('Attachments processed successfully', {
            trackingId,
            processed: attachments.length
          });

        } catch (err) {
          logger.error('Attachment processing failed', {
            trackingId,
            error: err.message
          });

          await email.addError('attachment_processing', err.message);
          await email.updateStatus('failed');
        }
      })().catch(err => {
        // Absolute safety net
        logger.error('Unhandled attachment worker error', {
          trackingId,
          error: err.message
        });
      });
    });

    return email;

  } catch (error) {
    logger.error('Email async processing failed', {
      trackingId,
      error: error.message
    });
    throw error;
  }
}


  async getStats(req, res) {
    try {
      const stats = await Email.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$processingStatus', 'completed'] }, 1, 0] }
            },
            processing: {
              $sum: { $cond: [
                { $in: ['$processingStatus', ['parsing', 'processing_attachments', 'parsed']] }, 
                1, 0
              ] }
            },
            failed: {
              $sum: { $cond: [{ $eq: ['$processingStatus', 'failed'] }, 1, 0] }
            }
          }
        }
      ]);

      const result = stats[0] || {
        total: 0,
        completed: 0,
        processing: 0,
        failed: 0
      };

      delete result._id;
      return successResponse(res, result);
    } catch (error) {
      logger.error('Error fetching stats:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async getAllEmails(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const { status, from, priority } = req.query;

      const query = {};
      if (status) query.processingStatus = status;
      if (from) query.from = from.toLowerCase();
      if (priority) query.priority = priority;

      const emails = await Email.find(query)
        .sort({ receivedAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .select('-htmlBody -body');

      const total = await Email.countDocuments(query);

      return successResponse(res, {
        emails,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      });
    } catch (error) {
      logger.error('Error fetching emails:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async getEmailByTrackingId(req, res) {
    try {
      const email = await Email.findOne({ trackingId: req.params.trackingId }).populate('attachments');
      
      if (!email) {
        return errorResponse(res, 'Email not found', 404);
      }

      // Also try to find a linked order
      const order = await Order.findOne({ emailId: email._id });

      return successResponse(res, {
        email,
        order
      });
    } catch (error) {
      logger.error('Error fetching email:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async deleteEmail(req, res) {
    try {
      const email = await Email.findOneAndDelete({ trackingId: req.params.trackingId });
      
      if (!email) {
        return errorResponse(res, 'Email not found', 404);
      }

      // Cleanup associated order if any
      await Order.deleteMany({ emailId: email._id });

      logger.info('Email deleted', { trackingId: req.params.trackingId });
      return successResponse(res, null, 'Email deleted successfully');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }

  async reprocessEmail(req, res) {
    try {
      const email = await Email.findOne({ trackingId: req.params.trackingId }).populate('attachments');
      if (!email) {
        return errorResponse(res, 'Email not found', 404);
      }

      logger.info('Manual re-processing triggered', { trackingId: email.trackingId });
      
      // Cleanup existing order if it failed or needs update
      await Order.deleteMany({ emailId: email._id });
      
      // Re-trigger extraction
      let order = null;
      let errorMsg = null;
      
      try {
        order = await this._attemptOrderExtraction(email);
      } catch (err) {
        errorMsg = err.message;
      }
      
      if (order) {
        return successResponse(res, { order }, 'Order extracted successfully');
      } else {
        const message = errorMsg || 'AI finished but no order was detected in the content.';
        return successResponse(res, { 
          noOrderFound: true,
          details: message 
        }, message);
      }

    } catch (error) {
       logger.error('Manual re-processing failed', { error: error.message });
       return errorResponse(res, error.message, 500);
    }
  }

  async _attemptOrderExtraction(email) {
    try {
      // 1. Check if an order already exists for this email
      const existingOrder = await Order.findOne({ emailId: email._id });
      if (existingOrder) {
        logger.info('Order already exists for this email, skipping extraction', { emailId: email._id });
        return existingOrder;
      }

      logger.info('Attempting AI Order Extraction', { emailId: email._id });

      let fullText = email.body || '';
      
      // Append attachment text if available
      if (email.attachments && email.attachments.length > 0) {
        const attachmentTexts = email.attachments
          .map(a => `[Attachment: ${a.originalName}]\n${a.extractedText || ''}`)
          .join('\n\n');
        fullText += `\n\n--- ATTACHMENTS ---\n${attachmentTexts}`;
      }

      const orderData = await aiService.extractOrderDetails(fullText);

      // Lowered threshold to 0.2 to capture simpler orders
      if (orderData && orderData.confidence >= 0.2) {
          const customerData = orderData.customer || {};
          
          // Fallback to sender data if AI extraction is missing fields
          if (!customerData.name && email.senderName) {
            customerData.name = email.senderName;
          }
          if (!customerData.email && email.from) {
            customerData.email = email.from;
          }

          // 3. Normalize items and calculate total if AI total is missing/inconsistent
          const items = (orderData.items || []).map(item => ({
            ...item,
            totalPrice: item.totalPrice || (item.quantity * item.unitPrice) || 0
          }));

          const calculatedTotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
          const finalTotal = (orderData.totalAmount && Math.abs(orderData.totalAmount - calculatedTotal) < 0.01) 
            ? orderData.totalAmount 
            : (calculatedTotal || orderData.totalAmount || 0);

          const order = new Order({
            emailId: email._id,
            emailTrackingId: email.trackingId,
            extractedOrderId: orderData.extractedOrderId,
            customer: customerData,
            items: items,
            totalAmount: finalTotal,
            currency: orderData.currency || 'USD',
            orderDate: orderData.orderDate ? new Date(orderData.orderDate) : new Date(),
            status: 'draft',
            aiConfidence: orderData.confidence,
            rawExtraction: orderData
          });
          
          await order.save();
          logger.info('Order extracted and saved to DB', { 
            orderId: order._id, 
            dbName: mongoose.connection.name,
            confidence: orderData.confidence 
          });

          // Sync to Salesforce (Fire and forget, or handle errors)
          try {
            salesforceService.syncOrder(order).catch(err => {
              logger.error('Background Salesforce sync failed', { error: err.message, orderId: order._id });
            });
          } catch (sfErr) {
            logger.error('Triggering Salesforce sync failed', { error: sfErr.message });
          }
          
          return order;
      } else {
        logger.info('No valid order detected by AI (confidence too low)', { confidence: orderData?.confidence });
        return null; 
      }
    } catch (err) {
      logger.error('Order extraction system error', { 
        error: err.message, 
        emailTrackingId: email.trackingId 
      });
      throw err;
    }
  }

  async convertToOrderManually(req, res) {
    try {
      const email = await Email.findOne({ trackingId: req.params.trackingId });
      if (!email) return errorResponse(res, 'Email not found', 404);

      // Create a basic order from email content
      const order = new Order({
        emailId: email._id,
        emailTrackingId: email.trackingId,
        customer: {
          email: email.from,
          name: email.senderName || 'Manual Customer'
        },
        items: [{
          description: 'Manually Identified Order',
          quantity: 1,
          unitPrice: 0,
          totalPrice: 0
        }],
        totalAmount: 0,
        currency: 'USD',
        status: 'draft',
        aiConfidence: 1.0, // Manual is 100%
        rawExtraction: { source: 'manual_conversion', originalBody: email.body }
      });

      await order.save();
      logger.info('Email manually converted to order', { orderId: order._id });

      // Sync to Salesforce
      try {
        salesforceService.syncOrder(order).catch(err => {
          logger.error('Manual Salesforce sync failed', { error: err.message });
        });
      } catch (sfErr) {
        logger.error('Triggering manual Salesforce sync failed', { error: sfErr.message });
      }

      return successResponse(res, order, 'Email converted to order manually');
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }
}

module.exports = new EmailController();