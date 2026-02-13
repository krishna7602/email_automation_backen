const { oauth2Client, gmail } = require('../config/gmail');
const GmailToken = require('../models/GmailToken');
const logger = require('../utils/logger');

exports.startAuth = (req, res) => {
  // 🔹 Use current request to determine redirect URI
  // Handle local development vs Render production
  const host = req.get('host');
  const isRender = host.includes('render.com');
  const protocol = isRender ? 'https' : req.protocol;
  
  const redirectUri = `${protocol}://${host}/api/auth/gmail/callback`;
  
  logger.info(`🔑 Starting Gmail OAuth Flow`, {
    host,
    protocol,
    redirectUri,
    isRender
  });
  
  // Set the redirect URI for THIS request
  oauth2Client.redirectUri = redirectUri;

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ]
  });
  res.redirect(url);
};

exports.oauthCallback = async (req, res) => {
  try {
    const { code } = req.query;

    // 🔹 Ensure redirectUri matches what was used in startAuth
    const host = req.get('host');
    const isRender = host.includes('render.com');
    const protocol = isRender ? 'https' : req.protocol;
    const redirectUri = `${protocol}://${host}/api/auth/gmail/callback`;
    
    oauth2Client.redirectUri = redirectUri;

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // 🔹 Get the real email address of the connected account
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const email = profile.data.emailAddress;

    if (!tokens.refresh_token) {
      console.warn('⚠️ No refresh token returned. This might happen if already connected. Forced consent should prevent this.');
    }

    // Update or create the token for this specific email
    await GmailToken.findOneAndUpdate(
      { email },
      {
        accessToken: tokens.access_token,
        ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
        expiryDate: new Date(tokens.expiry_date)
      },
      { upsert: true, new: true }
    );

    // Also remove any old 'primary@gmail.com' placeholder if it exists and is different
    if (email !== 'primary@gmail.com') {
      await GmailToken.deleteOne({ email: 'primary@gmail.com' });
    }

    res.json({ 
      message: 'Gmail connected successfully', 
      account: email,
      hasRefreshToken: !!tokens.refresh_token 
    });

  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).json({ message: 'OAuth failed' });
  }
};
