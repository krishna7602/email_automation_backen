const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  trackingId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  from: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true
  },
  to: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  cc: [String],
  subject: {
    type: String,
    required: true,
    trim: true
  },
  body: String,
  htmlBody: String,
  senderName: String,
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal',
    index: true
  },
  receivedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Processing status tracking
  processingStatus: {
    type: String,
    enum: ['pending', 'parsing', 'parsed', 'processing_attachments', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  processedAt: Date,
  
  // Email analysis
  analysis: {
    wordCount: Number,
    hasUrls: Boolean,
    urls: [String],
    emailAddresses: [String],
    phoneNumbers: [String],
    keywords: [{
      word: String,
      count: Number
    }]
  },

  // Attachment tracking
  hasAttachments: {
    type: Boolean,
    default: false
  },
  attachmentCount: {
    type: Number,
    default: 0
  },
  attachmentsProcessed: {
    type: Number,
    default: 0
  },
  attachments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attachment'
  }],
  
  // External system IDs
  salesforceId: String,
  businessCentralId: String,
  
  // Error tracking
  errors: [{
    stage: String,
    message: String,
    timestamp: Date
  }]

}, {
  timestamps: true,
  collection: 'emails'
});

// Indexes for performance
emailSchema.index({ createdAt: -1 });
emailSchema.index({ processingStatus: 1, createdAt: -1 });

// Update processing status
emailSchema.methods.updateStatus = function(status) {
  this.processingStatus = status;
  if (status === 'completed') {
    this.processedAt = new Date();
  }
  return this.save();
};

// Add error
emailSchema.methods.addError = function(stage, message) {
  this.errors.push({
    stage,
    message,
    timestamp: new Date()
  });
  this.processingStatus = 'failed';
  return this.save();
};

module.exports = mongoose.model('Email', emailSchema);