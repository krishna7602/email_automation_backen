const express = require('express');
const router = express.Router();
const webhookRoutes = require('./webhookRoutes.js');
const emailRoutes = require('./emailRoutes');
const gmailAuthRoutes = require('./gmailAuthRoutes');

// Mount routes
router.use('/webhook', webhookRoutes);
router.use('/emails', emailRoutes);
router.use('/orders', require('./orderRoutes')); // Registered new route
router.use('/auth/gmail', gmailAuthRoutes); 

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Email Processor API',
    version: '1.0.0',
    endpoints: {
      webhook: '/api/webhook/email'
    }
  });
});

module.exports = router;