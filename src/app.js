const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// Enable trust proxy for Render/proxies to get accurate req.protocol
app.set('trust proxy', true);

// --------------------
// Global Middlewares
// --------------------
const allowedOrigins = [
  'https://email-automation-frontend-omega.vercel.app',
  'https://email-automation-frontend-omega.vercel.app/',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------
// Logger
// --------------------
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: logger.stream }));
}

// --------------------
// Health & Root
// --------------------
app.get('/', (req, res) => {
  logger.info('Root endpoint accessed');
  res.json({
    message: 'Email Processor API',
    version: '1.0.0',
    status: 'running'
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ---------------------------------------------------------
// 🚀 EMERGENCY AUTH ALIASES (Placed at ROOT for 100% reach)
// ---------------------------------------------------------
app.get(['/connect', '/gmail-connect', '/auth-test'], (req, res) => {
  logger.info('⚡ Root-level auth alias triggered');
  res.redirect('/api/auth/gmail/connect');
});

// Handle the common typos or missing /api/
app.get(['/auth/gmail/connect', '/auth/google'], (req, res) => {
  res.redirect('/api/auth/gmail/connect');
});
// ---------------------------------------------------------

// --------------------
// Test Error
// --------------------
app.get('/test-error', (req, res, next) => {
  const error = new Error('This is a test error');
  error.statusCode = 400;
  next(error);
});

// --------------------
// Debug Request Logger
// --------------------
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    logger.info(`🔍 [${req.method}] ${req.url}`, {
      originalUrl: req.originalUrl,
      query: req.query,
      ip: req.ip
    });
  }
  next();
});

// --------------------
// API Routes
// --------------------
// Robust fix for duplicated API paths (e.g., /api/api/auth/...)
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/api')) {
    const cleanPath = req.originalUrl.replace(/^\/api\/api+/, '/api');
    logger.warn(`🔄 Fixing duplicated API path on Render: ${req.originalUrl} -> ${cleanPath}`);
    return res.redirect(cleanPath);
  }
  next();
});

app.use('/api', routes);

// 🔹 AGGRESSIVE AUTH ALIASES
// Catch every possible variation to ensure user never hits a 404 during auth
app.get([
  '/api/auth/google', 
  '/api/api/auth/google',
  '/api/auth/gmail',
  '/auth/gmail',
  '/auth/google',
  '/api/auth/google/connect',
  '/api/api/auth/gmail/connect'
], (req, res) => {
  logger.info(`🔀 Redirecting legacy/alternative auth path: ${req.originalUrl}`);
  res.redirect('/api/auth/gmail/connect');
});

// --------------------
// Error Handling
// --------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
