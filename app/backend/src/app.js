require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { collectDefaultMetrics, register } = require('prom-client');

const todoRoutes = require('./routes/todos');
const logger = require('./middleware/logger');
const sequelize = require('./db');

const app = express();

if (!process.env.CORS_ORIGIN && process.env.NODE_ENV === 'production') {
  throw new Error('CORS_ORIGIN environment variable is required in production');
}

if (process.env.NODE_ENV !== 'test') {
  collectDefaultMetrics({ prefix: 'mern_backend_' });
}

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

app.get('/health', (req, res) => res.json({ status: 'healthy', timestamp: new Date() }));
app.get('/ready', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ready', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'not ready', db: 'disconnected' });
  }
});

app.get('/metrics', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '';
  const isInternal = /^(::1|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(ip);
  if (!isInternal) return res.status(403).json({ error: 'Forbidden' });
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/api/todos', todoRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
