const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE || 'merndb',
  process.env.MYSQL_USER || 'mysql-user',
  process.env.MYSQL_PASSWORD || 'mysql-pass',
  {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    dialect: 'mysql',
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  }
);

module.exports = sequelize;
