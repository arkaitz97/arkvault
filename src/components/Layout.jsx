import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, X } from 'lucide-react';
import './Layout.css';

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [openPath, setOpenPath] = useState('/');
    const location = useLocation();

    // Close the mobile drawer when the route changes.
    if (location.pathname !== openPath) {
        setOpenPath(location.pathname);
        setSidebarOpen(false);
    }

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') setSidebarOpen(false);
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, []);

    return (
        <div className={`layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
            <button
                className="mobile-menu-btn"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            >
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <div className={`sidebar-wrapper ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
                <Sidebar />
            </div>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
