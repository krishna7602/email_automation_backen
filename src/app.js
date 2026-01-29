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
app.use(cors());
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
