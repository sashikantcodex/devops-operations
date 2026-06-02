const request = require('supertest');

const mockTodo = {
  id: 1,
  title: 'Test Todo',
  description: 'Test description',
  completed: false,
  priority: 'medium',
  tags: [],
  dueDate: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

jest.mock('../db', () => ({
  authenticate: jest.fn().mockResolvedValue(undefined),
  sync: jest.fn().mockResolvedValue(undefined),
  define: jest.fn().mockReturnValue({}),
}));

jest.mock('../models/todo', () => ({
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
}));

const app = require('../app');
const Todo = require('../models/todo');

beforeEach(() => jest.clearAllMocks());

describe('GET /api/todos', () => {
  it('returns paginated list', async () => {
    Todo.findAndCountAll.mockResolvedValue({ count: 1, rows: [mockTodo] });
    const res = await request(app).get('/api/todos');
    expect(res.status).toBe(200);
    expect(res.body.todos).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.pages).toBe(1);
  });

  it('filters by completed=true', async () => {
    Todo.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    await request(app).get('/api/todos?completed=true');
    expect(Todo.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { completed: true } })
    );
  });

  it('filters by priority', async () => {
    Todo.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    await request(app).get('/api/todos?priority=high');
    expect(Todo.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { priority: 'high' } })
    );
  });

  it('returns 500 on DB error', async () => {
    Todo.findAndCountAll.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/api/todos');
    expect(res.status).toBe(500);
  });
});

describe('GET /api/todos/:id', () => {
  it('returns a todo', async () => {
    Todo.findByPk.mockResolvedValue(mockTodo);
    const res = await request(app).get('/api/todos/1');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Test Todo');
  });

  it('returns 404 when not found', async () => {
    Todo.findByPk.mockResolvedValue(null);
    const res = await request(app).get('/api/todos/999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Todo not found');
  });
});

describe('POST /api/todos', () => {
  it('creates a todo and returns 201', async () => {
    Todo.create.mockResolvedValue(mockTodo);
    const res = await request(app)
      .post('/api/todos')
      .send({ title: 'Test Todo', priority: 'medium' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Test Todo');
  });

  it('returns 400 on validation error', async () => {
    Todo.create.mockRejectedValue(new Error('notNull Violation: title cannot be null'));
    const res = await request(app).post('/api/todos').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('PUT /api/todos/:id', () => {
  it('updates and returns the todo', async () => {
    Todo.update.mockResolvedValue([1]);
    Todo.findByPk.mockResolvedValue({ ...mockTodo, title: 'Updated' });
    const res = await request(app).put('/api/todos/1').send({ title: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
  });

  it('returns 404 when todo does not exist', async () => {
    Todo.update.mockResolvedValue([0]);
    const res = await request(app).put('/api/todos/999').send({ title: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Todo not found');
  });
});

describe('DELETE /api/todos/:id', () => {
  it('deletes a todo and returns id', async () => {
    const destroyMock = jest.fn().mockResolvedValue(undefined);
    Todo.findByPk.mockResolvedValue({ ...mockTodo, destroy: destroyMock });
    const res = await request(app).delete('/api/todos/1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
    expect(destroyMock).toHaveBeenCalled();
  });

  it('returns 404 when todo does not exist', async () => {
    Todo.findByPk.mockResolvedValue(null);
    const res = await request(app).delete('/api/todos/999');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/todos/:id/toggle', () => {
  it('toggles completed from false to true', async () => {
    const saveMock = jest.fn().mockResolvedValue(undefined);
    const todo = { ...mockTodo, completed: false, save: saveMock };
    Todo.findByPk.mockResolvedValue(todo);
    const res = await request(app).patch('/api/todos/1/toggle');
    expect(res.status).toBe(200);
    expect(todo.completed).toBe(true);
    expect(saveMock).toHaveBeenCalled();
  });

  it('toggles completed from true to false', async () => {
    const saveMock = jest.fn().mockResolvedValue(undefined);
    const todo = { ...mockTodo, completed: true, save: saveMock };
    Todo.findByPk.mockResolvedValue(todo);
    const res = await request(app).patch('/api/todos/1/toggle');
    expect(res.status).toBe(200);
    expect(todo.completed).toBe(false);
  });

  it('returns 404 when todo does not exist', async () => {
    Todo.findByPk.mockResolvedValue(null);
    const res = await request(app).patch('/api/todos/999/toggle');
    expect(res.status).toBe(404);
  });
});
