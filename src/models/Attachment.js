const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  attachmentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  emailTrackingId: {
    type: String,
    required: true,
    index: true
  },
  filename: {
    type: String,
    required: true
  },
  originalName: String,
  contentType: String,
  size: Number,
  
  // Cloud storage
  cloudStorageUrl: String,
  cloudPublicId: String,
  
  // Processing status
  processingStatus: {
    type: String,
    enum: ['pending', 'uploading', 'uploaded', 'extracting', 'extracted', 'analyzing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  
  // Extracted content
  extractedText: String,
  extractionMethod: String, // 'direct', 'ocr', 'ai'
  
  // AI analysis (Week 7)
  aiAnalysis: {
    summary: String,
    entities: [String],
    category: String,
    confidence: Number
  },
  
  // Error tracking
  errors: [{
    stage: String,
    message: String,
    timestamp: Date
  }],
  
  processedAt: Date

}, {
  timestamps: true,
  collection: 'attachments'
});

attachmentSchema.methods.updateStatus = function(status) {
  this.processingStatus = status;
  if (status === 'completed') {
    this.processedAt = new Date();
  }
  return this.save();
};

module.exports = mongoose.model('Attachment', attachmentSchema);