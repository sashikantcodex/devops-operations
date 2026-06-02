const winston = require('winston');

const consoleFormat = process.env.NODE_ENV === 'production'
  ? winston.format.json()
  : winston.format.combine(winston.format.colorize(), winston.format.simple());

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'mern-backend' },
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    ...(process.env.NODE_ENV !== 'test' ? [
      new winston.transports.File({ filename: '/var/log/app/error.log', level: 'error' }),
      new winston.transports.File({ filename: '/var/log/app/combined.log' }),
    ] : []),
  ],
});

module.exports = logger;
