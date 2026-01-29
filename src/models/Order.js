const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  emailId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Email',
    required: true
  },
  emailTrackingId: {
    type: String,
    required: true
  },
  extractedOrderId: {
    type: String,
    default: null
  },
  customer: {
    name: String,
    email: String,
    phone: String,
    address: String,
    company: String
  },
  items: [{
    description: String,
    quantity: Number,
    unitPrice: Number,
    totalPrice: Number,
    sku: String
  }],
  totalAmount: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['draft', 'confirmed', 'processing', 'completed', 'cancelled'],
    default: 'draft'
  },
  aiConfidence: {
    type: Number,
    default: 0
  },
  rawExtraction: {
    type: mongoose.Schema.Types.Mixed // Store full AI JSON response
  },
  salesforceId: {
    type: String,
    default: null
  },
  syncStatus: {
    type: String,
    enum: ['pending', 'synced', 'failed'],
    default: 'pending'
  },
  syncError: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', OrderSchema);
