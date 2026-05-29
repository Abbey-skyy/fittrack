'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const storedToken = localStorage.getItem('fittrack_token');
    const storedUser = localStorage.getItem('fittrack_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await axios.post('/api/auth/login', { email, password });
    const { token: newToken, user: newUser } = data.data;
    // Set header BEFORE clearing cache — any immediate refetch will have the token
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    localStorage.setItem('fittrack_token', newToken);
    localStorage.setItem('fittrack_user', JSON.stringify(newUser));
    queryClient.clear();
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, [queryClient]);

  const register = useCallback(async (name, email, password) => {
    const { data } = await axios.post('/api/auth/register', { name, email, password });
    const { token: newToken, user: newUser } = data.data;
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('fittrack_token', newToken);
    localStorage.setItem('fittrack_user', JSON.stringify(newUser));
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    return newUser;
  }, []);

  const logout = useCallback(() => {
    queryClient.clear(); // remove all cached queries so next login fetches fresh from DB
    setToken(null);
    setUser(null);
    localStorage.removeItem('fittrack_token');
    localStorage.removeItem('fittrack_user');
    delete axios.defaults.headers.common['Authorization'];
  }, [queryClient]);

  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('fittrack_user', JSON.stringify(updatedUser));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/user');
      updateUser(data.data);
    } catch {
      // silently ignore — e.g. if token expired
    }
  }, [updateUser]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser, refreshUser, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
