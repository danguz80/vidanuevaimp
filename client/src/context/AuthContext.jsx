import React, { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

  useEffect(() => {
    // Verificar si hay un token guardado al cargar la app
    const token = localStorage.getItem("token");
    if (token) {
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchRoles = async (token) => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/mis-roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRoles(response.data.roles || []);
    } catch {
      setRoles([]);
    }
  };

  const verifyToken = async (token) => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(response.data.user);
      await fetchRoles(token);
    } catch (error) {
      console.error("Token inválido:", error);
      localStorage.removeItem("token");
      setUser(null);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        username,
        password,
      });
      
      const { token, username: userName } = response.data;
      localStorage.setItem("token", token);
      setUser({ username: userName });
      await fetchRoles(token);
      return { success: true };
    } catch (error) {
      console.error("Error en login:", error);
      return { 
        success: false, 
        error: error.response?.data?.error || "Error al iniciar sesión" 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setRoles([]);
  };

  const loginWithToken = async (token) => {
    localStorage.setItem("token", token);
    await verifyToken(token);
  };

  const getToken = () => {
    return localStorage.getItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, roles, login, logout, loginWithToken, loading, getToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
};
