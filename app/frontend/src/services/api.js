import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export const todoService = {
  getAll: (params) => api.get('/todos', { params }).then((r) => r.data),
  getById: (id) => api.get(`/todos/${id}`).then((r) => r.data),
  create: (data) => api.post('/todos', data).then((r) => r.data),
  update: (id, data) => api.put(`/todos/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/todos/${id}`).then((r) => r.data),
  toggle: (id) => api.patch(`/todos/${id}/toggle`).then((r) => r.data),
};

export default api;
