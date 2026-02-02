const API_BASE = 'http://localhost:3001/api';

async function fetchAPI(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || 'Request failed');
    }

    return response.json();
}

export const connectorsAPI = {
    getAll: () => fetchAPI('/connectors'),
    get: (id) => fetchAPI(`/connectors/${id}`),
    create: (data) => fetchAPI('/connectors', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => fetchAPI(`/connectors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => fetchAPI(`/connectors/${id}`, { method: 'DELETE' }),
    test: (id) => fetchAPI(`/connectors/${id}/test`, { method: 'POST' }),
    testNew: (data) => fetchAPI('/connectors/test', { method: 'POST', body: JSON.stringify(data) })
};

export const jobsAPI = {
    getAll: () => fetchAPI('/jobs'),
    get: (id) => fetchAPI(`/jobs/${id}`),
    create: (data) => fetchAPI('/jobs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => fetchAPI(`/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => fetchAPI(`/jobs/${id}`, { method: 'DELETE' }),
    toggle: (id) => fetchAPI(`/jobs/${id}/toggle`, { method: 'POST' })
};

export const backupsAPI = {
    getHistory: () => fetchAPI('/backups/history'),
    getAvailable: () => fetchAPI('/backups/available'),
    getBackup: (id) => fetchAPI(`/backups/available/${id}`),
    run: (jobId) => fetchAPI(`/backups/run/${jobId}`, { method: 'POST' }),
    restore: (backupId, data) => fetchAPI(`/backups/restore/${backupId}`, { method: 'POST', body: JSON.stringify(data) }),
    cleanup: () => fetchAPI('/backups/cleanup', { method: 'DELETE' }),
    deleteHistory: (id) => fetchAPI(`/backups/history/${id}`, { method: 'DELETE' }),
    deleteBackup: (id) => fetchAPI(`/backups/available/${id}`, { method: 'DELETE' }),
    getDownloadUrl: (historyId) => `${API_BASE}/backups/download/${historyId}`
};

export const healthCheck = () => fetchAPI('/health');

export const connectorTypes = [
    {
        id: 'local',
        name: 'Local Folder',
        icon: 'Folder',
        canBeSource: true,
        canBeDestination: true,
        fields: [
            { name: 'path', label: 'Folder Path', type: 'text', required: true, placeholder: '/path/to/folder' }
        ]
    },
    {
        id: 'nfs',
        name: 'NFS Share',
        icon: 'HardDrive',
        canBeSource: true,
        canBeDestination: true,
        fields: [
            { name: 'host', label: 'NFS Server', type: 'text', required: true, placeholder: '192.168.1.100' },
            { name: 'path', label: 'Export Path', type: 'text', required: true, placeholder: '/exports/backup' },
            { name: 'mountOptions', label: 'Mount Options', type: 'text', placeholder: 'rw,soft,timeo=30' }
        ]
    },
    {
        id: 's3',
        name: 'S3 Compatible',
        icon: 'Cloud',
        canBeSource: true,
        canBeDestination: true,
        fields: [
            { name: 'endpoint', label: 'Endpoint URL (leave empty for AWS)', type: 'text', placeholder: 'https://s3.example.com' },
            { name: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1' },
            { name: 'bucket', label: 'Bucket Name', type: 'text', required: true },
            { name: 'prefix', label: 'Key Prefix', type: 'text', placeholder: 'backups/' },
            { name: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
            { name: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
            { name: 'forcePathStyle', label: 'Use Path-Style URLs', type: 'checkbox', default: true }
        ]
    },
    {
        id: 'gdrive',
        name: 'Google Drive',
        icon: 'Cloud',
        canBeSource: true,
        canBeDestination: true,
        fields: [
            { name: 'serviceAccountKey', label: 'Service Account JSON', type: 'textarea', required: true, placeholder: 'Paste service account JSON key...' },
            { name: 'folderId', label: 'Folder ID (optional)', type: 'text', placeholder: '1abc123...' }
        ]
    },
    {
        id: 'postgresql',
        name: 'PostgreSQL',
        icon: 'Database',
        canBeSource: true,
        canBeDestination: false,
        fields: [
            { name: 'host', label: 'Host', type: 'text', required: true, placeholder: 'localhost' },
            { name: 'port', label: 'Port', type: 'number', default: 5432 },
            { name: 'database', label: 'Database', type: 'text', required: true },
            { name: 'username', label: 'Username', type: 'text', required: true },
            { name: 'password', label: 'Password', type: 'password', required: true }
        ]
    }
];

export function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(ms) {
    if (!ms) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

export function getConnectorType(id) {
    return connectorTypes.find(c => c.id === id);
}

export const settingsAPI = {
    get: () => fetchAPI('/settings'),
    update: (data) => fetchAPI('/settings', { method: 'PUT', body: JSON.stringify(data) }),
    getStats: () => fetchAPI('/settings/stats'),
    runCleanup: () => fetchAPI('/settings/cleanup', { method: 'POST' })
};
