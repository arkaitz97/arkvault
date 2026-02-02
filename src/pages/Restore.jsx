import { useState, useEffect } from 'react';
import {
    RotateCcw,
    Search,
    Calendar,
    HardDrive,
    Cloud,
    Database,
    Lock,
    Archive,
    AlertCircle,
    ArrowRight,
    Loader2,
    Trash2
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { backupsAPI, formatBytes } from '../api';
import './Restore.css';

const getIcon = (jobName) => {
    if (jobName.toLowerCase().includes('database')) return Database;
    if (jobName.toLowerCase().includes('document')) return HardDrive;
    return Cloud;
};

export default function Restore() {
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBackup, setSelectedBackup] = useState(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [restoreProgress, setRestoreProgress] = useState(0);
    const [restoreConfig, setRestoreConfig] = useState({
        destinationType: 'local',
        destinationPath: ''
    });

    useEffect(() => {
        loadBackups();
    }, []);

    const loadBackups = async () => {
        try {
            setLoading(true);
            const data = await backupsAPI.getAvailable();
            setBackups(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredBackups = backups.filter(backup =>
        backup.job_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleRestore = async () => {
        if (!selectedBackup) return;

        setIsRestoring(true);
        setRestoreProgress(0);

        try {
            const progressInterval = setInterval(() => {
                setRestoreProgress(prev => Math.min(prev + 10, 90));
            }, 500);

            await backupsAPI.restore(selectedBackup.id, {
                destination_type: restoreConfig.destinationType,
                destination_path: restoreConfig.destinationType === 'local' ? restoreConfig.destinationPath : undefined
            });

            clearInterval(progressInterval);
            setRestoreProgress(100);

            setTimeout(() => {
                setIsRestoring(false);
                setRestoreProgress(0);
                setSelectedBackup(null);
                alert('Restore completed successfully!');
            }, 500);
        } catch (err) {
            setIsRestoring(false);
            setRestoreProgress(0);
            setError(err.message);
        }
    };

    const handleDeleteBackup = async () => {
        if (!selectedBackup) return;
        if (!window.confirm(`Are you sure you want to delete this backup? This cannot be undone.`)) return;

        try {
            setIsDeleting(true);
            await backupsAPI.deleteBackup(selectedBackup.id);
            setSelectedBackup(null);
            await loadBackups();
            alert('Backup deleted successfully!');
        } catch (err) {
            setError(err.message);
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="restore-page animate-fadeIn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
                <Loader2 size={48} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
        );
    }

    return (
        <div className="restore-page animate-fadeIn">
            <header className="page-header">
                <h1>Restore from Backup</h1>
                <p>Recover your data from available backups</p>
            </header>

            {error && (
                <div className="card" style={{ padding: '1rem', marginBottom: '1rem', background: 'var(--error-bg)', borderColor: 'var(--error)' }}>
                    <p style={{ color: 'var(--error)', margin: 0 }}>{error}</p>
                    <button className="btn btn-ghost" style={{ marginTop: '0.5rem' }} onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            <div className="restore-layout">
                {/* Backup List */}
                <section className="backup-list-section">
                    <div className="section-header">
                        <h2>Available Backups</h2>
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                className="input"
                                placeholder="Search backups..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="backup-list">
                        {filteredBackups.length === 0 ? (
                            <div className="empty-state card">
                                <Archive size={48} />
                                <p>No backups found</p>
                            </div>
                        ) : (
                            filteredBackups.map((backup) => {
                                const Icon = getIcon(backup.job_name);
                                return (
                                    <button
                                        key={backup.id}
                                        className={`backup-item card ${selectedBackup?.id === backup.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedBackup(backup)}
                                    >
                                        <div className="backup-icon">
                                            <Icon size={24} />
                                        </div>
                                        <div className="backup-info">
                                            <span className="backup-name">{backup.job_name}</span>
                                            <span className="backup-date">
                                                <Calendar size={14} />
                                                {format(new Date(backup.timestamp), 'MMM d, yyyy HH:mm')}
                                            </span>
                                        </div>
                                        <div className="backup-meta">
                                            <span className="backup-size">{formatBytes(backup.size || 0)}</span>
                                            <div className="backup-badges">
                                                {backup.encrypted && (
                                                    <span className="mini-badge" title="Encrypted">
                                                        <Lock size={12} />
                                                    </span>
                                                )}
                                                {backup.compressed && (
                                                    <span className="mini-badge" title="Compressed">
                                                        <Archive size={12} />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <ArrowRight size={18} className="item-arrow" />
                                    </button>
                                );
                            })
                        )}
                    </div>
                </section>

                {/* Restore Panel */}
                <section className="restore-panel">
                    {!selectedBackup ? (
                        <div className="no-selection card">
                            <RotateCcw size={64} />
                            <h3>Select a Backup</h3>
                            <p>Choose a backup from the list to restore</p>
                        </div>
                    ) : isRestoring ? (
                        <div className="restore-progress card">
                            <div className="progress-icon animate-spin">
                                <RotateCcw size={48} />
                            </div>
                            <h3>Restoring...</h3>
                            <p>Please wait while your data is being restored</p>
                            <div className="progress-container">
                                <div className="progress">
                                    <div
                                        className="progress-bar"
                                        style={{ width: `${restoreProgress}%` }}
                                    />
                                </div>
                                <span className="progress-text">{Math.round(restoreProgress)}%</span>
                            </div>
                        </div>
                    ) : (
                        <div className="restore-details card">
                            <h3>Restore Details</h3>

                            <div className="detail-section">
                                <h4>Backup Information</h4>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <span className="detail-label">Job Name</span>
                                        <span className="detail-value">{selectedBackup.job_name}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Backup Date</span>
                                        <span className="detail-value">
                                            {format(new Date(selectedBackup.timestamp), 'PPpp')}
                                        </span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Size</span>
                                        <span className="detail-value">{formatBytes(selectedBackup.size || 0)}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Location</span>
                                        <span className="detail-value text-sm">{selectedBackup.location}</span>
                                    </div>
                                    {selectedBackup.expires_at && (
                                        <div className="detail-item">
                                            <span className="detail-label">Expires</span>
                                            <span className="detail-value">
                                                {formatDistanceToNow(new Date(selectedBackup.expires_at), { addSuffix: true })}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="detail-section">
                                <h4>Restore Destination</h4>
                                <div className="restore-form">
                                    <div className="input-group">
                                        <label>Destination Type</label>
                                        <select
                                            className="input select"
                                            value={restoreConfig.destinationType}
                                            onChange={(e) => setRestoreConfig({ ...restoreConfig, destinationType: e.target.value })}
                                        >
                                            <option value="local">Local Folder</option>
                                            <option value="original">Original Location</option>
                                        </select>
                                    </div>

                                    {restoreConfig.destinationType === 'local' && (
                                        <div className="input-group">
                                            <label>Destination Path</label>
                                            <input
                                                type="text"
                                                className="input"
                                                placeholder="/path/to/restore/"
                                                value={restoreConfig.destinationPath}
                                                onChange={(e) => setRestoreConfig({ ...restoreConfig, destinationPath: e.target.value })}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="restore-warning">
                                <AlertCircle size={20} />
                                <span>
                                    Restoring will overwrite any existing files in the destination.
                                    Make sure you have a backup of critical data.
                                </span>
                            </div>

                            <div className="restore-actions">
                                <button
                                    className="btn btn-ghost danger"
                                    onClick={handleDeleteBackup}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <Trash2 size={18} />
                                    )}
                                    Delete Backup
                                </button>
                                <div style={{ flex: 1 }} />
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setSelectedBackup(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleRestore}
                                    disabled={restoreConfig.destinationType === 'local' && !restoreConfig.destinationPath}
                                >
                                    <RotateCcw size={18} />
                                    Start Restore
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
