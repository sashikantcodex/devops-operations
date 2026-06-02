const request = require('supertest');

jest.mock('../db', () => ({
  authenticate: jest.fn().mockResolvedValue(undefined),
  sync: jest.fn().mockResolvedValue(undefined),
  define: jest.fn().mockReturnValue({}),
}));

jest.mock('../models/todo', () => ({}));

const app = require('../app');

describe('Health & system endpoints', () => {
  it('GET /health returns 200 with healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /ready returns 200 when DB is reachable', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready', db: 'connected' });
  });

  it('GET /ready returns 503 when DB is unreachable', async () => {
    const sequelize = require('../db');
    sequelize.authenticate.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'not ready', db: 'disconnected' });
  });

  it('GET /unknown returns 404', async () => {
    const res = await request(app).get('/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Route not found');
  });
});
