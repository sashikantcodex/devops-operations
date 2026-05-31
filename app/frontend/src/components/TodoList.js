import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Box, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  List, ListItem, ListItemText, ListItemSecondaryAction, IconButton,
  Checkbox, Chip, Typography, Paper, CircularProgress, Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { todoService } from '../services/api';

const PRIORITIES = ['low', 'medium', 'high'];
const PRIORITY_COLORS = { low: 'success', medium: 'warning', high: 'error' };

export default function TodoList() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });
  const [filter, setFilter] = useState({});

  const { data, isLoading, error } = useQuery(['todos', filter], () => todoService.getAll(filter));

  const createMutation = useMutation(todoService.create, {
    onSuccess: () => { qc.invalidateQueries('todos'); setForm({ title: '', description: '', priority: 'medium' }); },
  });

  const toggleMutation = useMutation((id) => todoService.toggle(id), {
    onSuccess: () => qc.invalidateQueries('todos'),
  });

  const deleteMutation = useMutation((id) => todoService.remove(id), {
    onSuccess: () => qc.invalidateQueries('todos'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    createMutation.mutate(form);
  };

  if (error) return <Alert severity="error">Failed to load todos: {error.message}</Alert>;

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Add New Todo</Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="Title" required size="small" sx={{ flex: 2, minWidth: 200 }}
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <TextField
            label="Description" size="small" sx={{ flex: 3, minWidth: 200 }}
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Priority</InputLabel>
            <Select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>
          <Button type="submit" variant="contained" disabled={createMutation.isLoading}>
            {createMutation.isLoading ? <CircularProgress size={20} /> : 'Add'}
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Filter Priority</InputLabel>
            <Select label="Filter Priority" value={filter.priority || ''} onChange={(e) => setFilter({ ...filter, priority: e.target.value || undefined })}>
              <MenuItem value="">All</MenuItem>
              {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={filter.completed ?? ''} onChange={(e) => setFilter({ ...filter, completed: e.target.value === '' ? undefined : e.target.value })}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="false">Pending</MenuItem>
              <MenuItem value="true">Completed</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : (
        <Paper>
          <List>
            {data?.todos?.length === 0 && (
              <ListItem><ListItemText primary="No todos found. Add one above!" /></ListItem>
            )}
            {data?.todos?.map((todo) => (
              <ListItem key={todo._id} divider sx={{ opacity: todo.completed ? 0.6 : 1 }}>
                <Checkbox checked={todo.completed} onChange={() => toggleMutation.mutate(todo._id)} />
                <ListItemText
                  primary={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>{todo.title}</span>
                    <Chip label={todo.priority} color={PRIORITY_COLORS[todo.priority]} size="small" />
                  </Box>}
                  secondary={todo.description}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" onClick={() => deleteMutation.mutate(todo._id)} color="error">
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
          {data?.total > 0 && (
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption">Total: {data.total} | Page {data.page} of {data.pages}</Typography>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}
