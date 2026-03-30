import React, { createContext, useContext, useState, useEffect } from "react";

const MemberAuthContext = createContext(null);

export function MemberAuthProvider({ children }) {
  const [miembro, setMiembro] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("miembro_token");
    const stored = localStorage.getItem("miembro_data");
    if (token && stored) {
      setMiembro(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const login = (token, data) => {
    localStorage.setItem("miembro_token", token);
    localStorage.setItem("miembro_data", JSON.stringify(data));
    setMiembro(data);
  };

  const logout = () => {
    localStorage.removeItem("miembro_token");
    localStorage.removeItem("miembro_data");
    setMiembro(null);
  };

  const getToken = () => localStorage.getItem("miembro_token");

  return (
    <MemberAuthContext.Provider value={{ miembro, loading, login, logout, getToken }}>
      {children}
    </MemberAuthContext.Provider>
  );
}

export function useMemberAuth() {
  return useContext(MemberAuthContext);
}
