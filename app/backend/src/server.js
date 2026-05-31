require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { collectDefaultMetrics, register } = require('prom-client');

const todoRoutes = require('./routes/todos');
const logger = require('./middleware/logger');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/merndb';

if (!process.env.CORS_ORIGIN && process.env.NODE_ENV === 'production') {
  throw new Error('CORS_ORIGIN environment variable is required in production');
}

// Prometheus metrics
collectDefaultMetrics({ prefix: 'mern_backend_' });

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

// Health & readiness probes
app.get('/health', (req, res) => res.json({ status: 'healthy', timestamp: new Date() }));
app.get('/ready', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  if (dbState === 1) return res.json({ status: 'ready', db: 'connected' });
  res.status(503).json({ status: 'not ready', db: 'disconnected' });
});

// Prometheus metrics endpoint — internal cluster access only
app.get('/metrics', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '';
  const isInternal = /^(::1|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(ip);
  if (!isInternal) return res.status(403).json({ error: 'Forbidden' });
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// API Routes
app.use('/api/todos', todoRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    logger.info(`MongoDB connected: ${MONGO_URI.replace(/:([^@]+)@/, ':****@')}`);
    app.listen(PORT, () => logger.info(`Backend running on port ${PORT}`));
  })
  .catch((err) => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;
