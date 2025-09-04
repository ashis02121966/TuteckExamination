import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { NetworkProvider } from './contexts/NetworkContext';
import { Login } from './pages/Login';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ProtectedRoutes } from './components/ProtectedRoutes';

function App() {
  return (
    <Router>
      <NetworkProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <ProtectedRoutes />
            </ProtectedRoute>
          } />
        </Routes>
      </NetworkProvider>
    </Router>
  );
}

export default App;