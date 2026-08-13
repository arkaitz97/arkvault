import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [authenticated, setAuthenticated] = useState(null);
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    const checkAuth = async () => {
        try {
            const response = await fetch(`${API_BASE}/auth/status`, { credentials: 'include' });
            const data = await response.json();
            setAuthenticated(data.authenticated);
            setMustChangePassword(data.mustChangePassword);
            if (data.authenticated) {
                setUser(data.user);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            setAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        console.log('[AuthContext] Redirection effect:', { loading, authenticated, mustChangePassword, path: location.pathname });
        if (!loading) {
            if (!authenticated && location.pathname !== '/login') {
                console.log('[AuthContext] Redirecting to /login');
                navigate('/login', { state: { from: location } });
            } else if (authenticated && mustChangePassword && location.pathname !== '/change-password') {
                console.log('[AuthContext] Redirecting to /change-password');
                navigate('/change-password');
            }
        }
    }, [authenticated, mustChangePassword, loading, location, navigate]);

    const login = async (username, password) => {
        console.log('[AuthContext] Attempting login...');
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            console.log('[AuthContext] Login successful:', data);
            setAuthenticated(true);
            setMustChangePassword(data.mustChangePassword);
            setUser(data.user);
            return { success: true, mustChangePassword: data.mustChangePassword };
        } else {
            const error = await response.json();
            console.error('[AuthContext] Login failed:', error);
            return { success: false, error: error.error || 'Login failed' };
        }
    };

    const logout = async () => {
        await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
        setAuthenticated(false);
        setMustChangePassword(false);
        navigate('/login');
    };

    const changePassword = async (newPassword, confirmPassword) => {
        console.log('[AuthContext] Attempting changePassword...');
        const response = await fetch(`${API_BASE}/auth/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPassword, confirmPassword }),
            credentials: 'include'
        });

        if (response.ok) {
            console.log('[AuthContext] Password change successful');
            setMustChangePassword(false);
            return { success: true };
        } else {
            const error = await response.json();
            console.error('[AuthContext] Password change failed:', error);
            return { success: false, error: error.error || 'Change password failed' };
        }
    };

    return (
        <AuthContext.Provider value={{
            authenticated,
            mustChangePassword,
            user,
            loading,
            login,
            logout,
            changePassword,
            checkAuth
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
