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
import './Settings.css';

export default function Settings() {
    const [settings, setSettings] = useState({
        defaultRetention: 30,
        defaultCompression: true,
        defaultEncryption: false,
        notificationsEnabled: false,
        notificationEmail: ''
    });
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const [settingsData, statsData] = await Promise.all([
                settingsAPI.get(),
                settingsAPI.getStats()
            ]);
            setSettings(settingsData);
            setStats(statsData);
        } catch (err) {
            showMessage('error', 'Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await settingsAPI.update(settings);
            showMessage('success', 'Settings saved successfully');
        } catch (err) {
            showMessage('error', 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleCleanup = async () => {
        if (!window.confirm('This will delete old backups based on retention policies. Continue?')) {
            return;
        }
        try {
            setCleaning(true);
            const result = await settingsAPI.runCleanup();
            showMessage('success', `Cleanup complete: ${result.deleted} backups removed`);
            const statsData = await settingsAPI.getStats();
            setStats(statsData);
        } catch (err) {
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
                <div className="header-content">
                    <SettingsIcon size={28} />
                    <div>
                        <h1>Settings</h1>
                        <p className="header-subtitle">Configure ArkVault preferences</p>
                    </div>
                </div>
            </header>

            {message && (
                <div className={`message ${message.type}`}>
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    {message.text}
                </div>
            )}

            <div className="settings-grid">
                {/* Backup Defaults */}
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
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.defaultCompression}
                                    onChange={(e) => setSettings({ ...settings, defaultCompression: e.target.checked })}
                                />
                                <span>Enable compression by default</span>
                            </label>
                        </div>

                        <div className="form-group checkbox-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.defaultEncryption}
                                    onChange={(e) => setSettings({ ...settings, defaultEncryption: e.target.checked })}
                                />
                                <span>Enable encryption by default</span>
                            </label>
                        </div>
                    </div>
                </section>

                {/* Notifications */}
                <section className="settings-card">
                    <div className="card-header">
                        <Bell size={20} />
                        <h2>Notifications</h2>
                    </div>
                    <div className="card-body">
                        <div className="form-group checkbox-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.notificationsEnabled}
                                    onChange={(e) => setSettings({ ...settings, notificationsEnabled: e.target.checked })}
                                />
                                <span>Enable email notifications</span>
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

                        <p className="coming-soon">More notification options coming soon</p>
                    </div>
                </section>

                {/* Database & Maintenance */}
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
            </div>

            <div className="settings-actions">
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="spinner" size={18} /> : <Save size={18} />}
                    Save Settings
                </button>
                <button className="btn btn-secondary" onClick={loadSettings}>
                    <RefreshCw size={18} />
                    Reset
                </button>
            </div>
        </div>
    );
}
