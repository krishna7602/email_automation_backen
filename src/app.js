const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// --------------------
// Global Middlewares
// --------------------
const allowedOrigins = [
  'https://email-automation-frontend-omega.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
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

// --------------------
// Test Error
// --------------------
app.get('/test-error', (req, res, next) => {
  const error = new Error('This is a test error');
  error.statusCode = 400;
  next(error);
});

// --------------------
// API Routes
// --------------------
app.use('/api', routes);

// --------------------
// Error Handling
// --------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
