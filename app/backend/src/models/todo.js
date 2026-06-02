const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Todo = sequelize.define(
  'Todo',
  {
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.STRING(1000) },
    completed: { type: DataTypes.BOOLEAN, defaultValue: false },
    priority: { type: DataTypes.ENUM('low', 'medium', 'high'), defaultValue: 'medium' },
    tags: { type: DataTypes.JSON, defaultValue: [] },
    dueDate: { type: DataTypes.DATE },
  },
  {
    timestamps: true,
    indexes: [{ fields: ['completed'] }, { fields: ['priority'] }],
  }
);

module.exports = Todo;
