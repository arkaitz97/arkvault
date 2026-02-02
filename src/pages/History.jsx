import { useState, useEffect } from 'react';
import {
    Calendar,
    CheckCircle2,
    XCircle,
    Clock,
    Filter,
    Search,
    ChevronDown,
    AlertTriangle,
    FileText,
    Loader2,
    RefreshCw,
    Download,
    Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { backupsAPI, formatBytes } from '../api';
import './History.css';

const formatDuration = (startTime, endTime) => {
    if (!endTime) return 'In progress';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return `${diffSecs}s`;
    const diffMins = Math.floor(diffSecs / 60);
    const remainingSecs = diffSecs % 60;
    if (diffMins < 60) return `${diffMins}m ${remainingSecs}s`;
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    return `${diffHours}h ${remainingMins}m`;
};

export default function History() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [expandedItem, setExpandedItem] = useState(null);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            setLoading(true);
            const data = await backupsAPI.getHistory();
            setHistory(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredHistory = history
        .filter(item => {
            const matchesSearch = item.job_name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    const successCount = history.filter(h => h.status === 'success').length;
    const failedCount = history.filter(h => h.status === 'failed').length;

    const handleRerun = async (e, jobId) => {
        e.stopPropagation();
        try {
            setActionLoading(jobId);
            const result = await backupsAPI.run(jobId);
            if (result.success) {
                alert(`Backup completed! Size: ${result.size} bytes`);
                await loadHistory();
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDownload = (e, historyId) => {
        e.stopPropagation();
        window.open(backupsAPI.getDownloadUrl(historyId), '_blank');
    };

    const handleDelete = async (e, historyId) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this history entry?')) return;

        try {
            setActionLoading(historyId);
            await backupsAPI.deleteHistory(historyId);
            await loadHistory();
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="history-page animate-fadeIn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
                <Loader2 size={48} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
        );
    }

    return (
        <div className="history-page animate-fadeIn">
            <header className="page-header">
                <h1>Backup History</h1>
                <p>View all backup operations and their results</p>
            </header>

            {error && (
                <div className="card" style={{ padding: '1rem', marginBottom: '1rem', background: 'var(--error-bg)', borderColor: 'var(--error)' }}>
                    <p style={{ color: 'var(--error)', margin: 0 }}>{error}</p>
                    <button className="btn btn-ghost" style={{ marginTop: '0.5rem' }} onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            {/* Stats Bar */}
            <div className="stats-bar">
                <div className="stat-item">
                    <span className="stat-value">{history.length}</span>
                    <span className="stat-label">Total Backups</span>
                </div>
                <div className="stat-item success">
                    <CheckCircle2 size={20} />
                    <span className="stat-value">{successCount}</span>
                    <span className="stat-label">Successful</span>
                </div>
                <div className="stat-item error">
                    <XCircle size={20} />
                    <span className="stat-value">{failedCount}</span>
                    <span className="stat-label">Failed</span>
                </div>
            </div>

            {/* Filters */}
            <div className="filters-bar card">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        className="input"
                        placeholder="Search by job name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="filter-group">
                    <Filter size={18} />
                    <select
                        className="input select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Status</option>
                        <option value="success">Success Only</option>
                        <option value="failed">Failed Only</option>
                    </select>
                </div>
            </div>

            {/* History Table */}
            {filteredHistory.length === 0 ? (
                <div className="empty-state card">
                    <FileText size={64} />
                    <h3>No Backup History</h3>
                    <p>No backup records match your filters</p>
                </div>
            ) : (
                <div className="history-table card">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Job Name</th>
                                <th>Start Time</th>
                                <th>Duration</th>
                                <th>Size</th>
                                <th>Files</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredHistory.map((item) => (
                                <>
                                    <tr
                                        key={item.id}
                                        className={`history-row ${expandedItem === item.id ? 'expanded' : ''}`}
                                        onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                                    >
                                        <td>
                                            {item.status === 'success' ? (
                                                <span className="status-icon success">
                                                    <CheckCircle2 size={18} />
                                                </span>
                                            ) : (
                                                <span className="status-icon error">
                                                    <XCircle size={18} />
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <span className="job-name">{item.job_name}</span>
                                        </td>
                                        <td>
                                            <div className="time-cell">
                                                <span className="time-primary">
                                                    {format(new Date(item.start_time), 'MMM d, yyyy')}
                                                </span>
                                                <span className="time-secondary">
                                                    {format(new Date(item.start_time), 'HH:mm:ss')}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="duration">
                                                <Clock size={14} />
                                                {formatDuration(item.start_time, item.end_time)}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="size">{formatBytes(item.size || 0)}</span>
                                        </td>
                                        <td>
                                            <span className="files-count">{(item.files_processed || 0).toLocaleString()}</span>
                                        </td>
                                        <td>
                                            <ChevronDown
                                                size={18}
                                                className={`expand-icon ${expandedItem === item.id ? 'rotated' : ''}`}
                                            />
                                        </td>
                                    </tr>
                                    {expandedItem === item.id && (
                                        <tr className="detail-row">
                                            <td colSpan={7}>
                                                <div className="detail-content animate-slideUp">
                                                    <div className="detail-grid">
                                                        <div className="detail-item">
                                                            <span className="detail-label">Backup ID</span>
                                                            <span className="detail-value">{item.id}</span>
                                                        </div>
                                                        <div className="detail-item">
                                                            <span className="detail-label">Job ID</span>
                                                            <span className="detail-value">{item.job_id}</span>
                                                        </div>
                                                        <div className="detail-item">
                                                            <span className="detail-label">Destination</span>
                                                            <span className="detail-value">{item.destination || 'N/A'}</span>
                                                        </div>
                                                        <div className="detail-item">
                                                            <span className="detail-label">Completed At</span>
                                                            <span className="detail-value">
                                                                {item.end_time ? format(new Date(item.end_time), 'PPpp') : 'In progress'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {item.error && (
                                                        <div className="error-message">
                                                            <AlertTriangle size={18} />
                                                            <span>{item.error}</span>
                                                        </div>
                                                    )}

                                                    <div className="detail-actions">
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={(e) => handleRerun(e, item.job_id)}
                                                            disabled={actionLoading === item.job_id}
                                                        >
                                                            {actionLoading === item.job_id ? (
                                                                <Loader2 size={16} className="animate-spin" />
                                                            ) : (
                                                                <RefreshCw size={16} />
                                                            )}
                                                            Re-run Backup
                                                        </button>

                                                        {item.backup_location && item.status === 'success' && (
                                                            <button
                                                                className="btn btn-secondary btn-sm"
                                                                onClick={(e) => handleDownload(e, item.id)}
                                                            >
                                                                <Download size={16} />
                                                                Download
                                                            </button>
                                                        )}

                                                        <button
                                                            className="btn btn-ghost btn-sm danger"
                                                            onClick={(e) => handleDelete(e, item.id)}
                                                            disabled={actionLoading === item.id}
                                                        >
                                                            {actionLoading === item.id ? (
                                                                <Loader2 size={16} className="animate-spin" />
                                                            ) : (
                                                                <Trash2 size={16} />
                                                            )}
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
