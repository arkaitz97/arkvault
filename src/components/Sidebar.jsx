import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    FolderSync,
    PlusCircle,
    RotateCcw,
    Plug,
    History,
    Settings,
    HardDrive
} from 'lucide-react';
import './Sidebar.css';

const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/jobs', icon: FolderSync, label: 'Backup Jobs' },
    { path: '/create', icon: PlusCircle, label: 'Create Backup' },
    { path: '/restore', icon: RotateCcw, label: 'Restore' },
    { path: '/connectors', icon: Plug, label: 'Connectors' },
    { path: '/history', icon: History, label: 'History' },
];

export default function Sidebar() {
    const location = useLocation();

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="logo">
                    <div className="logo-icon">
                        <svg viewBox="0 0 32 32" width="24" height="24">
                            <path d="M16 4L6 11v13l10 7 10-7V11L16 4z" fill="none" stroke="currentColor" strokeWidth="2" />
                            <path d="M16 9l-6 4v8l6 4 6-4v-8l-6-4z" fill="currentColor" opacity="0.3" />
                            <circle cx="16" cy="16" r="3.5" fill="currentColor" />
                        </svg>
                    </div>
                    <div className="logo-text">
                        <span className="logo-title">ArkVault</span>
                        <span className="logo-subtitle">Backup Manager</span>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                <ul className="nav-list">
                    {navItems.map((item) => (
                        <li key={item.path}>
                            <NavLink
                                to={item.path}
                                className={({ isActive }) =>
                                    `nav-link ${isActive ? 'active' : ''}`
                                }
                            >
                                <item.icon size={20} className="nav-icon" />
                                <span className="nav-label">{item.label}</span>
                                {location.pathname === item.path && (
                                    <div className="nav-indicator" />
                                )}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="sidebar-footer">
                <NavLink to="/settings" className={({ isActive }) => `nav-link settings-link ${isActive ? 'active' : ''}`}>
                    <Settings size={20} className="nav-icon" />
                    <span className="nav-label">Settings</span>
                </NavLink>
                <div className="version-info">
                    <span>v1.0.0</span>
                </div>
            </div>
        </aside>
    );
}
