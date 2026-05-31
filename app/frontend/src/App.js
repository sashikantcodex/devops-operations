import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ThemeProvider, createTheme, CssBaseline, Container, AppBar, Toolbar, Typography } from '@mui/material';
import TodoList from './components/TodoList';

const queryClient = new QueryClient();
const theme = createTheme({ palette: { mode: 'light', primary: { main: '#1976d2' } } });

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              MERN DevOps Todo App
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              v{process.env.REACT_APP_VERSION || '1.0.0'} | {process.env.REACT_APP_ENV || 'development'}
            </Typography>
          </Toolbar>
        </AppBar>
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <TodoList />
        </Container>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
