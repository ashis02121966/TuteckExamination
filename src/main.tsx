import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorHandler } from './utils/errorHandler';
import App from './App.tsx';
import './index.css';

// Initialize error handling
if (import.meta.env.PROD) {
  ErrorHandler.suppressConsoleWarnings();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
