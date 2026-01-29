const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');

router.get('/stats', emailController.getStats);
router.get('/', emailController.getAllEmails);
router.get('/:trackingId', emailController.getEmailByTrackingId);
router.post('/:trackingId/reprocess', emailController.reprocessEmail);
router.post('/:trackingId/convert', emailController.convertToOrderManually);
router.delete('/:trackingId', emailController.deleteEmail);

module.exports = router;