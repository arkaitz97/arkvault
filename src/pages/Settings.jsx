import { useState, useEffect } from 'react';
import {
    Settings as SettingsIcon,
    Save,
    RefreshCw,
    Database,
    Bell,
    Shield,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Trash2
} from 'lucide-react';
import { settingsAPI, formatBytes } from '../api';
import ConfirmationModal from '../components/ConfirmationModal';
import './Settings.css';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export default function Settings() {
    const [settings, setSettings] = useState({
        defaultRetention: 30,
        defaultCompression: true,
        defaultEncryption: false,
        notificationsEnabled: false,
        notificationEmail: '',
        webhookUrl: ''
    });
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [message, setMessage] = useState(null);
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });
    const [tokens, setTokens] = useState([]);
    const [newTokenName, setNewTokenName] = useState('');
    const [newToken, setNewToken] = useState(null);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const [settingsData, statsData] = await Promise.all([
                settingsAPI.get(),
                settingsAPI.getStats()
            ]);
            setSettings(settingsData);
            setStats(statsData);
        } catch {
            showMessage('error', 'Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();
        loadTokens();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    const loadTokens = async () => {
        try {
            const res = await fetch(`${API_BASE}/tokens`, { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            setTokens(Array.isArray(data) ? data : []);
        } catch {
            // ignore
        }
    };

    const handleCreateToken = async () => {
        if (!newTokenName.trim()) return;
        try {
            const res = await fetch(`${API_BASE}/tokens`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newTokenName, scopes: [] })
            });
            if (!res.ok) {
                showMessage('error', 'Failed to create token');
                return;
            }
            const data = await res.json();
            setNewToken(data.token);
            setNewTokenName('');
            loadTokens();
        } catch {
            showMessage('error', 'Failed to create token');
        }
    };

    const handleRevokeToken = async (id) => {
        try {
            const res = await fetch(`${API_BASE}/tokens/${id}`, { method: 'DELETE', credentials: 'include' });
            if (!res.ok) {
                showMessage('error', 'Failed to revoke token');
                return;
            }
            loadTokens();
        } catch {
            showMessage('error', 'Failed to revoke token');
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await settingsAPI.update(settings);
            showMessage('success', 'Settings saved successfully');
        } catch {
            showMessage('error', 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleCleanup = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Run Cleanup?',
            message: 'This will permanently delete old backups based on your retention policies. This action cannot be undone.',
            onConfirm: performCleanup
        });
    };

    const performCleanup = async () => {
        try {
            setCleaning(true);
            const result = await settingsAPI.runCleanup();
            showMessage('success', `Cleanup complete: ${result.deleted} backups removed`);
            const statsData = await settingsAPI.getStats();
            setStats(statsData);
        } catch {
            showMessage('error', 'Cleanup failed');
        } finally {
            setCleaning(false);
        }
    };

    if (loading) {
        return (
            <div className="settings-page">
                <div className="loading-state">
                    <Loader2 className="spinner" size={32} />
                    <p>Loading settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="settings-page">
            <header className="page-header">
                <h1>Settings</h1>
                <p>Configure ArkVault preferences</p>
            </header>

            {message && (
                <div className={`message ${message.type}`}>
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    {message.text}
                </div>
            )}

            <div className="settings-grid">

                <section className="settings-card">
                    <div className="card-header">
                        <Shield size={20} />
                        <h2>Backup Defaults</h2>
                    </div>
                    <div className="card-body">
                        <div className="form-group">
                            <label htmlFor="retention">Default Retention (days)</label>
                            <input
                                type="number"
                                id="retention"
                                min="1"
                                max="365"
                                value={settings.defaultRetention}
                                onChange={(e) => setSettings({ ...settings, defaultRetention: parseInt(e.target.value) || 30 })}
                            />
                            <span className="help-text">Backups older than this will be deleted</span>
                        </div>

                        <div className="form-group checkbox-group">
                            <label className="toggle-option">
                                <span>Enable compression by default</span>
                                <input
                                    type="checkbox"
                                    checked={settings.defaultCompression}
                                    onChange={(e) => setSettings({ ...settings, defaultCompression: e.target.checked })}
                                />
                            </label>
                        </div>

                        <div className="form-group checkbox-group">
                            <label className="toggle-option">
                                <span>Enable encryption by default</span>
                                <input
                                    type="checkbox"
                                    checked={settings.defaultEncryption}
                                    onChange={(e) => setSettings({ ...settings, defaultEncryption: e.target.checked })}
                                />
                            </label>
                        </div>
                    </div>
                </section>


                <section className="settings-card">
                    <div className="card-header">
                        <Bell size={20} />
                        <h2>Notifications</h2>
                    </div>
                    <div className="card-body">
                        <div className="form-group checkbox-group">
                            <label className="toggle-option">
                                <span>Enable email notifications</span>
                                <input
                                    type="checkbox"
                                    checked={settings.notificationsEnabled}
                                    onChange={(e) => setSettings({ ...settings, notificationsEnabled: e.target.checked })}
                                />
                            </label>
                        </div>

                        {settings.notificationsEnabled && (
                            <div className="form-group">
                                <label htmlFor="email">Notification Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    placeholder="your@email.com"
                                    value={settings.notificationEmail}
                                    onChange={(e) => setSettings({ ...settings, notificationEmail: e.target.value })}
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="webhook">Webhook URL</label>
                            <input
                                type="url"
                                id="webhook"
                                placeholder="https://example.com/hook"
                                value={settings.webhookUrl || ''}
                                onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                            />
                            <span className="help-text">POST backup status to this URL</span>
                        </div>
                    </div>
                </section>


                <section className="settings-card">
                    <div className="card-header">
                        <Database size={20} />
                        <h2>Database & Maintenance</h2>
                    </div>
                    <div className="card-body">
                        {stats && (
                            <div className="stats-grid">
                                <div className="stat-item">
                                    <span className="stat-label">Total Backups</span>
                                    <span className="stat-value">{stats.totalBackups}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Total Size</span>
                                    <span className="stat-value">{formatBytes(stats.totalSize)}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Active Jobs</span>
                                    <span className="stat-value">{stats.activeJobs}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Connectors</span>
                                    <span className="stat-value">{stats.connectors}</span>
                                </div>
                            </div>
                        )}

                        <div className="maintenance-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={handleCleanup}
                                disabled={cleaning}
                            >
                                {cleaning ? <Loader2 className="spinner" size={16} /> : <Trash2 size={16} />}
                                Run Cleanup
                            </button>
                        </div>
                    </div>
                </section>

                <section className="settings-card">
                    <div className="card-header">
                        <Shield size={20} />
                        <h2>API Tokens</h2>
                    </div>
                    <div className="card-body">
                        <div className="form-group">
                            <label htmlFor="token-name">Token Name</label>
                            <div className="token-create-row">
                                <input
                                    type="text"
                                    id="token-name"
                                    placeholder="e.g. CI server"
                                    value={newTokenName}
                                    onChange={(e) => setNewTokenName(e.target.value)}
                                />
                                <button
                                    className="btn btn-secondary"
                                    onClick={handleCreateToken}
                                    disabled={!newTokenName.trim()}
                                >
                                    Create Token
                                </button>
                            </div>
                        </div>

                        {newToken && (
                            <div className="form-group">
                                <label htmlFor="new-token">New Token (copy now — it won't be shown again)</label>
                                <input type="text" id="new-token" readOnly value={newToken} />
                            </div>
                        )}

                        {tokens.length > 0 && (
                            <ul className="token-list">
                                {tokens.map((token) => (
                                    <li key={token.id} className="token-item">
                                        <div className="token-info">
                                            <span className="token-name">{token.name}</span>
                                            <span className="token-meta">
                                                {token.created_at} {token.revoked ? '— revoked' : ''}
                                            </span>
                                        </div>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => handleRevokeToken(token.id)}
                                            disabled={token.revoked === 1}
                                        >
                                            Revoke
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>
            </div>

            <div className="settings-actions">
                <button className="btn btn-primary" onClick={handleSave} disabled={saving} data-testid="save-settings-button">
                    {saving ? <Loader2 className="spinner" size={18} /> : <Save size={18} />}
                    Save Settings
                </button>
                <button className="btn btn-secondary" onClick={loadSettings}>
                    <RefreshCw size={18} />
                    Reset
                </button>
            </div>

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText="Run Cleanup"
                type="warning"
            />
        </div>
    );
}
