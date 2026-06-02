const express = require('express');
const router = express.Router();
const Todo = require('../models/todo');
const logger = require('../middleware/logger');

// GET all todos
router.get('/', async (req, res) => {
  try {
    const { completed, priority, page = 1, limit = 10 } = req.query;
    const where = {};
    if (completed !== undefined) where.completed = completed === 'true';
    if (priority) where.priority = priority;

    const offset = (Number(page) - 1) * Number(limit);
    const { count: total, rows: todos } = await Todo.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset,
    });
    res.json({ todos, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error('GET /todos error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET single todo
router.get('/:id', async (req, res) => {
  try {
    const todo = await Todo.findByPk(req.params.id);
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    res.json(todo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create todo
router.post('/', async (req, res) => {
  try {
    const { title, description, priority, tags, dueDate } = req.body;
    const todo = await Todo.create({ title, description, priority, tags, dueDate });
    res.status(201).json(todo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update todo
router.put('/:id', async (req, res) => {
  try {
    const [updated] = await Todo.update(req.body, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ error: 'Todo not found' });
    const todo = await Todo.findByPk(req.params.id);
    res.json(todo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE todo
router.delete('/:id', async (req, res) => {
  try {
    const todo = await Todo.findByPk(req.params.id);
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    await todo.destroy();
    res.json({ message: 'Todo deleted', id: todo.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH toggle completed
router.patch('/:id/toggle', async (req, res) => {
  try {
    const todo = await Todo.findByPk(req.params.id);
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    todo.completed = !todo.completed;
    await todo.save();
    res.json(todo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
