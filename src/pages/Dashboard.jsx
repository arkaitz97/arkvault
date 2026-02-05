import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    CheckCircle2,
    XCircle,
    Clock,
    PlusCircle,
    ArrowRight,
    FolderSync,
    HardDrive,
    Cloud,
    Database,
    TrendingUp,
    Calendar,
    Loader2
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { jobsAPI, backupsAPI, connectorsAPI, formatBytes } from '../api';
import './Dashboard.css';

export default function Dashboard() {
    const [jobs, setJobs] = useState([]);
    const [history, setHistory] = useState([]);
    const [connectors, setConnectors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [jobsData, historyData, connectorsData] = await Promise.all([
                jobsAPI.getAll(),
                backupsAPI.getHistory(),
                connectorsAPI.getAll()
            ]);
            setJobs(jobsData);
            setHistory(historyData);
            setConnectors(connectorsData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const activeJobs = jobs.filter(j => j.status === 'active').length;
    const totalBackups = history.filter(h => h.status === 'success').length;
    const failedBackups = history.filter(h => h.status === 'failed').length;
    const totalSize = history
        .filter(h => h.status === 'success')
        .reduce((acc, h) => acc + (h.size || 0), 0);

    const recentHistory = [...history]
        .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
        .slice(0, 5);

    const upcomingJobs = jobs
        .filter(j => j.status === 'active' && j.next_run)
        .sort((a, b) => new Date(a.next_run) - new Date(b.next_run))
        .slice(0, 3);

    if (loading) {
        return (
            <div className="dashboard animate-fadeIn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
                <Loader2 size={48} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard animate-fadeIn">
                <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <XCircle size={48} style={{ color: 'var(--error)', marginBottom: '1rem' }} />
                    <h2>Connection Error</h2>
                    <p style={{ color: 'var(--text-muted)' }}>{error}</p>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Make sure the backend server is running: <code>npm run server</code>
                    </p>
                    <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={loadData}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard animate-fadeIn">
            <header className="page-header">
                <h1>Dashboard</h1>
                <p>Overview of your backup operations</p>
            </header>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon active">
                        <FolderSync size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{activeJobs}</span>
                        <span className="stat-label">Active Jobs</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon success">
                        <CheckCircle2 size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{totalBackups}</span>
                        <span className="stat-label">Successful Backups</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon error">
                        <XCircle size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{failedBackups}</span>
                        <span className="stat-label">Failed Backups</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon info">
                        <TrendingUp size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{formatBytes(totalSize)}</span>
                        <span className="stat-label">Total Backup Size</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-grid">
                <section className="dashboard-section">
                    <div className="section-header">
                        <h2>Recent Backups</h2>
                        <Link to="/history" className="section-link">
                            View all <ArrowRight size={16} />
                        </Link>
                    </div>
                    <div className="card">
                        {recentHistory.length === 0 ? (
                            <div className="empty-state">
                                <Clock size={48} />
                                <p>No backup history yet</p>
                            </div>
                        ) : (
                            <div className="history-list">
                                {recentHistory.map((item) => (
                                    <div key={item.id} className="history-item">
                                        <div className="history-status">
                                            {item.status === 'success' ? (
                                                <CheckCircle2 size={20} className="status-success" />
                                            ) : (
                                                <XCircle size={20} className="status-error" />
                                            )}
                                        </div>
                                        <div className="history-info">
                                            <span className="history-name">{item.job_name}</span>
                                            <span className="history-meta">
                                                {format(new Date(item.start_time), 'MMM d, yyyy HH:mm')} • {formatBytes(item.size || 0)}
                                            </span>
                                        </div>
                                        <span className={`badge badge-${item.status === 'success' ? 'success' : 'error'}`}>
                                            {item.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <section className="dashboard-section">
                    <div className="section-header">
                        <h2>Upcoming Backups</h2>
                        <Link to="/jobs" className="section-link">
                            Manage jobs <ArrowRight size={16} />
                        </Link>
                    </div>
                    <div className="card">
                        {upcomingJobs.length === 0 ? (
                            <div className="empty-state">
                                <Calendar size={48} />
                                <p>No scheduled backups</p>
                            </div>
                        ) : (
                            <div className="upcoming-list">
                                {upcomingJobs.map((job) => (
                                    <div key={job.id} className="upcoming-item">
                                        <div className="upcoming-icon">
                                            <Clock size={20} />
                                        </div>
                                        <div className="upcoming-info">
                                            <span className="upcoming-name">{job.name}</span>
                                            <span className="upcoming-time">
                                                {formatDistanceToNow(new Date(job.next_run), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <span className="upcoming-schedule">{job.schedule_description}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <section className="dashboard-section full-width">
                    <div className="section-header">
                        <h2>Connected Sources</h2>
                        <Link to="/connectors" className="section-link">
                            Manage connectors <ArrowRight size={16} />
                        </Link>
                    </div>
                    <div className="connectors-grid">
                        {connectors.length === 0 ? (
                            <div className="card empty-state" style={{ gridColumn: '1 / -1' }}>
                                <Database size={48} />
                                <p>No connectors configured</p>
                                <Link to="/connectors" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                                    <PlusCircle size={18} />
                                    Add Connector
                                </Link>
                            </div>
                        ) : (
                            connectors.map((connector) => (
                                <div key={connector.id} className="connector-card card">
                                    <div className={`connector-icon ${connector.type}`}>
                                        {connector.type === 'local' && <HardDrive size={24} />}
                                        {connector.type === 's3' && <Cloud size={24} />}
                                        {connector.type === 'postgresql' && <Database size={24} />}
                                        {connector.type === 'nfs' && <HardDrive size={24} />}
                                        {connector.type === 'gdrive' && <Cloud size={24} />}
                                    </div>
                                    <div className="connector-info">
                                        <span className="connector-name">{connector.name}</span>
                                        <span className="connector-type">{connector.type.toUpperCase()}</span>
                                    </div>
                                    <span className={`badge badge-${connector.status === 'connected' ? 'success' : 'error'}`}>
                                        {connector.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>

            <section className="quick-actions">
                <Link to="/create" className="btn btn-primary btn-lg">
                    <PlusCircle size={20} />
                    Create New Backup Job
                </Link>
                <Link to="/restore" className="btn btn-secondary btn-lg">
                    Restore from Backup
                </Link>
            </section>
        </div>
    );
}
