const express = require('express');
const router = express.Router();
const gmailAuthController = require('../controllers/gmailAuthController');

router.get('/connect', gmailAuthController.startAuth);
router.get('/callback', gmailAuthController.oauthCallback);

module.exports = router;
