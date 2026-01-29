const mongoose = require('mongoose');

const gmailTokenSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },

  accessToken: {
    type: String,
    required: true
  },

  refreshToken: {
    type: String,
    required: true
  },

  expiryDate: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('GmailToken', gmailTokenSchema);
