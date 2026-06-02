require('./models/todo'); // register model with sequelize
const app = require('./app');
const sequelize = require('./db');
const logger = require('./middleware/logger');

const PORT = process.env.PORT || 5000;

sequelize
  .sync({ alter: true })
  .then(() => {
    const host = process.env.MYSQL_HOST || 'localhost';
    const port = process.env.MYSQL_PORT || 3306;
    logger.info(`MySQL connected: ${host}:${port}`);
    app.listen(PORT, () => logger.info(`Backend running on port ${PORT}`));
  })
  .catch((err) => {
    logger.error('MySQL connection error:', err);
    process.exit(1);
  });

module.exports = app;
