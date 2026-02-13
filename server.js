require('dotenv').config();

const app = require('./src/app');
const logger = require('./src/utils/logger');
const { connectDB } = require('./src/config/db');
const { loadGmailTokens } = require('./src/config/gmail');
const gmailFetcher = require('./src/services/gmailFetcher');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // 1️⃣ Connect DB
    await connectDB();
    logger.info('MongoDB connected');

    // 2️⃣ Load Gmail OAuth tokens into memory (🔥 REQUIRED)
    await loadGmailTokens();

    // 3️⃣ Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(
        `🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`
      );
      console.log(`🚀 http://localhost:${PORT}`);
    });

    // 4️⃣ Gmail polling (Sequential to avoid overlapping and rate limits)
    if (process.env.ENABLE_GMAIL_POLLING === 'true') {
      logger.info('📧 Gmail polling enabled');

      const pollGmail = async () => {
        try {
          logger.info('Checking for new emails...');
          await gmailFetcher.fetchUnreadEmails();
          
          // If successful, schedule next poll normally
          setTimeout(pollGmail, 30 * 1000);
        } catch (err) {
          if (err.message === 'invalid_grant' || err.data?.error === 'invalid_grant') {
            logger.error('🔴 GMAIL AUTHENTICATION FAILED: Token expired or revoked.');
            logger.error('👉 ACTION REQUIRED: Please re-authenticate at http://localhost:3000/api/auth/gmail/connect');
            logger.info('⏳ Polling paused. Server will retry in 5 minutes, or restart after re-authenticating.');
            setTimeout(pollGmail, 5 * 60 * 1000); // 5 minute wait for auth issues
          } else {
            logger.error('Gmail polling failed', err);
            setTimeout(pollGmail, 30 * 1000);
          }
        }
      };

      pollGmail();
    }

    // 5️⃣ Safety net
    process.on('unhandledRejection', err => {
      logger.error('Unhandled Rejection', {
        error: err.message,
        stack: err.stack
      });
      server.close(() => process.exit(1));
    });

  } catch (err) {
    logger.error('Server startup failed', {
      error: err.message
    });
    process.exit(1);
  }
};

startServer();
