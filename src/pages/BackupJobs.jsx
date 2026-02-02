import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    PlusCircle,
    Play,
    Pause,
    Trash2,
    Edit,
    MoreVertical,
    Clock,
    CheckCircle2,
    XCircle,
    Calendar,
    HardDrive,
    Cloud,
    Database,
    Network,
    CloudCog,
    Loader2,
    X,
    Save
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { jobsAPI, connectorsAPI, backupsAPI, getConnectorType } from '../api';
import './BackupJobs.css';

const getConnectorIcon = (type) => {
    switch (type) {
        case 'local': return HardDrive;
        case 'nfs': return Network;
        case 's3': return Cloud;
        case 'gdrive': return CloudCog;
        case 'postgresql': return Database;
        default: return HardDrive;
    }
};

const schedulePresets = [
    { id: 'hourly', label: 'Hourly', cron: '0 * * * *', description: 'Every hour' },
    { id: 'daily', label: 'Daily', cron: '0 2 * * *', description: 'Daily at 2:00 AM' },
    { id: 'weekly', label: 'Weekly', cron: '0 2 * * 0', description: 'Every Sunday at 2:00 AM' },
    { id: 'monthly', label: 'Monthly', cron: '0 2 1 * *', description: '1st of each month at 2:00 AM' },
    { id: 'custom', label: 'Custom', cron: '', description: 'Custom schedule' }
];

export default function BackupJobs() {
    const [jobs, setJobs] = useState([]);
    const [connectors, setConnectors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [runningJob, setRunningJob] = useState(null);
    const [activeMenu, setActiveMenu] = useState(null);
    const [error, setError] = useState(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingJob, setEditingJob] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [jobsData, connectorsData] = await Promise.all([
                jobsAPI.getAll(),
                connectorsAPI.getAll()
            ]);
            setJobs(jobsData);
            setConnectors(connectorsData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getConnectorName = (connectorId) => {
        const connector = connectors.find(c => c.id === connectorId);
        return connector?.name || 'Unknown';
    };

    const toggleJobStatus = async (jobId) => {
        try {
            await jobsAPI.toggle(jobId);
            await loadData();
        } catch (err) {
            setError(err.message);
        }
    };

    const deleteJob = async (jobId) => {
        if (window.confirm('Are you sure you want to delete this backup job?')) {
            try {
                setActiveMenu(null);
                await jobsAPI.delete(jobId);
                await loadData();
            } catch (err) {
                setError(err.message);
            }
        }
    };

    const runNow = async (jobId) => {
        try {
            setRunningJob(jobId);
            const result = await backupsAPI.run(jobId);
            if (result.success) {
                alert(`Backup completed! Size: ${result.size} bytes`);
            }
            await loadData();
        } catch (err) {
            setError(err.message);
        } finally {
            setRunningJob(null);
        }
    };

    const openEditModal = (job) => {
        setActiveMenu(null);
        const schedulePreset = schedulePresets.find(s => s.cron === job.schedule) || schedulePresets.find(s => s.id === 'custom');
        setEditingJob({
            ...job,
            schedulePreset: schedulePreset.id,
            customCron: schedulePreset.id === 'custom' ? job.schedule : ''
        });
        setEditModalOpen(true);
    };

    const closeEditModal = () => {
        setEditModalOpen(false);
        setEditingJob(null);
    };

    const saveJob = async () => {
        if (!editingJob) return;

        try {
            setSaving(true);
            const selectedSchedule = schedulePresets.find(s => s.id === editingJob.schedulePreset);
            const schedule = editingJob.schedulePreset === 'custom' ? editingJob.customCron : selectedSchedule?.cron;
            const scheduleDescription = editingJob.schedulePreset === 'custom' ? 'Custom schedule' : selectedSchedule?.description;

            await jobsAPI.update(editingJob.id, {
                name: editingJob.name,
                schedule,
                schedule_description: scheduleDescription,
                retention: editingJob.retention,
                compression: editingJob.compression,
                encryption: editingJob.encryption
            });

            closeEditModal();
            await loadData();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="backup-jobs animate-fadeIn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
                <Loader2 size={48} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
        );
    }

    return (
        <div className="backup-jobs animate-fadeIn">
            <header className="page-header">
                <div className="header-content">
                    <div>
                        <h1>Backup Jobs</h1>
                        <p>Manage your scheduled backup tasks</p>
                    </div>
                    <Link to="/create" className="btn btn-primary">
                        <PlusCircle size={20} />
                        New Backup Job
                    </Link>
                </div>
            </header>

            {error && (
                <div className="card" style={{ padding: '1rem', marginBottom: '1rem', background: 'var(--error-bg)', borderColor: 'var(--error)' }}>
                    <p style={{ color: 'var(--error)', margin: 0 }}>{error}</p>
                    <button className="btn btn-ghost" style={{ marginTop: '0.5rem' }} onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            {jobs.length === 0 ? (
                <div className="empty-state card">
                    <Calendar size={64} />
                    <h3>No Backup Jobs</h3>
                    <p>Create your first backup job to get started</p>
                    <Link to="/create" className="btn btn-primary">
                        <PlusCircle size={20} />
                        Create Backup Job
                    </Link>
                </div>
            ) : (
                <div className="jobs-list">
                    {jobs.map((job) => {
                        const SourceIcon = getConnectorIcon(job.source_type);
                        const DestIcon = getConnectorIcon(job.destination_type);
                        const sourceType = getConnectorType(job.source_type);
                        const destType = getConnectorType(job.destination_type);

                        return (
                            <div key={job.id} className={`job-card card ${job.status}`}>
                                <div className="job-header">
                                    <div className="job-title">
                                        <h3>{job.name}</h3>
                                        <span className={`badge badge-${job.status === 'active' ? 'success' : 'warning'}`}>
                                            {job.status}
                                        </span>
                                    </div>
                                    <div className="job-actions">
                                        <button
                                            className="btn btn-icon btn-ghost"
                                            onClick={() => runNow(job.id)}
                                            disabled={runningJob === job.id}
                                            title="Run now"
                                        >
                                            {runningJob === job.id ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : (
                                                <Play size={18} />
                                            )}
                                        </button>
                                        <button
                                            className="btn btn-icon btn-ghost"
                                            onClick={() => toggleJobStatus(job.id)}
                                            title={job.status === 'active' ? 'Pause' : 'Resume'}
                                        >
                                            {job.status === 'active' ? <Pause size={18} /> : <Play size={18} />}
                                        </button>
                                        <div className="dropdown">
                                            <button
                                                className="btn btn-icon btn-ghost"
                                                onClick={() => setActiveMenu(activeMenu === job.id ? null : job.id)}
                                            >
                                                <MoreVertical size={18} />
                                            </button>
                                            {activeMenu === job.id && (
                                                <div className="dropdown-menu">
                                                    <button
                                                        className="dropdown-item"
                                                        onClick={() => openEditModal(job)}
                                                    >
                                                        <Edit size={16} /> Edit
                                                    </button>
                                                    <button
                                                        className="dropdown-item danger"
                                                        onClick={() => deleteJob(job.id)}
                                                    >
                                                        <Trash2 size={16} /> Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="job-flow">
                                    <div className="flow-endpoint source">
                                        <div className={`connector-icon ${job.source_type}`}>
                                            <SourceIcon size={20} />
                                        </div>
                                        <div className="endpoint-info">
                                            <span className="endpoint-label">Source</span>
                                            <span className="endpoint-name">
                                                {job.source_connector_id ? getConnectorName(job.source_connector_id) : 'Inline config'}
                                            </span>
                                            <span className="endpoint-type">{sourceType?.name || job.source_type}</span>
                                        </div>
                                    </div>

                                    <div className="flow-arrow">
                                        <div className="arrow-line"></div>
                                        <div className="arrow-head"></div>
                                    </div>

                                    <div className="flow-endpoint destination">
                                        <div className={`connector-icon ${job.destination_type}`}>
                                            <DestIcon size={20} />
                                        </div>
                                        <div className="endpoint-info">
                                            <span className="endpoint-label">Destination</span>
                                            <span className="endpoint-name">
                                                {job.destination_connector_id ? getConnectorName(job.destination_connector_id) : 'Inline config'}
                                            </span>
                                            <span className="endpoint-type">{destType?.name || job.destination_type}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="job-details">
                                    <div className="detail-item">
                                        <Clock size={16} />
                                        <span>{job.schedule_description || job.schedule}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Last run:</span>
                                        {job.last_run ? (
                                            <>
                                                <span>{format(new Date(job.last_run), 'MMM d, HH:mm')}</span>
                                                {job.last_run_status === 'success' ? (
                                                    <CheckCircle2 size={16} className="status-success" />
                                                ) : (
                                                    <XCircle size={16} className="status-error" />
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-muted">Never</span>
                                        )}
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Next run:</span>
                                        {job.next_run ? (
                                            <span>{formatDistanceToNow(new Date(job.next_run), { addSuffix: true })}</span>
                                        ) : (
                                            <span className="text-muted">Not scheduled</span>
                                        )}
                                    </div>
                                </div>

                                <div className="job-options">
                                    {job.compression && (
                                        <span className="option-badge">Compressed</span>
                                    )}
                                    {job.encryption && (
                                        <span className="option-badge">Encrypted</span>
                                    )}
                                    <span className="option-badge">{job.retention || 30} days retention</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Edit Modal */}
            {editModalOpen && editingJob && (
                <div className="modal-overlay" onClick={closeEditModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Edit Backup Job</h3>
                            <button className="btn btn-icon btn-ghost" onClick={closeEditModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="input-group">
                                <label>Job Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={editingJob.name}
                                    onChange={(e) => setEditingJob({ ...editingJob, name: e.target.value })}
                                />
                            </div>

                            <div className="input-group">
                                <label>Schedule</label>
                                <select
                                    className="input select"
                                    value={editingJob.schedulePreset}
                                    onChange={(e) => setEditingJob({ ...editingJob, schedulePreset: e.target.value })}
                                >
                                    {schedulePresets.map(preset => (
                                        <option key={preset.id} value={preset.id}>{preset.label} - {preset.description}</option>
                                    ))}
                                </select>
                            </div>

                            {editingJob.schedulePreset === 'custom' && (
                                <div className="input-group">
                                    <label>Cron Expression</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="* * * * *"
                                        value={editingJob.customCron}
                                        onChange={(e) => setEditingJob({ ...editingJob, customCron: e.target.value })}
                                    />
                                </div>
                            )}

                            <div className="input-group">
                                <label>Retention (days)</label>
                                <input
                                    type="number"
                                    className="input"
                                    min="1"
                                    max="365"
                                    value={editingJob.retention || 30}
                                    onChange={(e) => setEditingJob({ ...editingJob, retention: parseInt(e.target.value) })}
                                />
                            </div>

                            <div className="toggle-options">
                                <label className="toggle-option">
                                    <span>Compression</span>
                                    <input
                                        type="checkbox"
                                        checked={editingJob.compression}
                                        onChange={(e) => setEditingJob({ ...editingJob, compression: e.target.checked })}
                                    />
                                </label>
                                <label className="toggle-option">
                                    <span>Encryption</span>
                                    <input
                                        type="checkbox"
                                        checked={editingJob.encryption}
                                        onChange={(e) => setEditingJob({ ...editingJob, encryption: e.target.checked })}
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={closeEditModal}>Cancel</button>
                            <button className="btn btn-primary" onClick={saveJob} disabled={saving}>
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
