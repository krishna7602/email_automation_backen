const { google } = require('googleapis');
const GmailToken = require('../models/GmailToken');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const logger = require('../utils/logger');

/**
 * 🔹 Load tokens from DB on server startup
 */
const loadGmailTokens = async () => {
  const token = await GmailToken.findOne();
  if (!token) {
    logger.warn('⚠️ No Gmail tokens found in DB');
    return;
  }

  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiryDate.getTime()
  });

  logger.info('✅ Gmail tokens loaded into OAuth client');
  logger.info(`📦 Refresh Token present: ${!!token.refreshToken}`);
};

/**
 * 🔹 AUTO-REFRESH HANDLER (THIS IS STEP 4)
 * Google triggers this automatically when access token expires
 */
oauth2Client.on('tokens', async (tokens) => {
  try {
    if (!tokens.refresh_token && !tokens.access_token) return;

    await GmailToken.findOneAndUpdate(
      {},
      {
        ...(tokens.access_token && { accessToken: tokens.access_token }),
        ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
        ...(tokens.expiry_date && { expiryDate: new Date(tokens.expiry_date) })
      }
    );

    console.log('🔄 Gmail tokens auto-refreshed and saved');

  } catch (err) {
    console.error('❌ Failed to persist refreshed Gmail token', err);
  }
});

const gmail = google.gmail({
  version: 'v1',
  auth: oauth2Client
});

module.exports = {
  oauth2Client,
  gmail,
  loadGmailTokens
};
