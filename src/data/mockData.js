
export const connectorTypes = {
    local: {
        id: 'local',
        name: 'Local Folder',
        icon: 'HardDrive',
        description: 'Backup to/from local filesystem',
        canBeSource: true,
        canBeDestination: true,
        fields: [
            { name: 'path', label: 'Folder Path', type: 'text', placeholder: '/path/to/folder', required: true }
        ]
    },
    nfs: {
        id: 'nfs',
        name: 'NFS Share',
        icon: 'Network',
        description: 'Network File System mount',
        canBeSource: true,
        canBeDestination: true,
        fields: [
            { name: 'host', label: 'NFS Host', type: 'text', placeholder: 'nfs.example.com', required: true },
            { name: 'path', label: 'Export Path', type: 'text', placeholder: '/exports/backup', required: true },
            { name: 'mountOptions', label: 'Mount Options', type: 'text', placeholder: 'rw,sync' }
        ]
    },
    s3: {
        id: 's3',
        name: 'AWS S3',
        icon: 'Cloud',
        description: 'Amazon S3 cloud storage',
        canBeSource: false,
        canBeDestination: true,
        fields: [
            { name: 'bucket', label: 'Bucket Name', type: 'text', placeholder: 'my-backup-bucket', required: true },
            { name: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1', required: true },
            { name: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
            { name: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
            { name: 'prefix', label: 'Prefix (optional)', type: 'text', placeholder: 'backups/' }
        ]
    },
    gdrive: {
        id: 'gdrive',
        name: 'Google Drive',
        icon: 'CloudCog',
        description: 'Google Drive cloud storage',
        canBeSource: false,
        canBeDestination: true,
        fields: [
            { name: 'folderId', label: 'Folder ID', type: 'text', placeholder: 'Folder ID from Google Drive URL', required: true },
            { name: 'serviceAccountKey', label: 'Service Account JSON', type: 'textarea', required: true }
        ]
    },
    postgresql: {
        id: 'postgresql',
        name: 'PostgreSQL',
        icon: 'Database',
        description: 'PostgreSQL database backup using pg_dump',
        canBeSource: true,
        canBeDestination: false,
        fields: [
            { name: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true },
            { name: 'port', label: 'Port', type: 'number', placeholder: '5432', required: true },
            { name: 'database', label: 'Database Name', type: 'text', required: true },
            { name: 'username', label: 'Username', type: 'text', required: true },
            { name: 'password', label: 'Password', type: 'password', required: true }
        ]
    }
};

export const mockConnectors = [
    {
        id: '1',
        type: 'local',
        name: 'Documents Folder',
        config: { path: '/home/user/Documents' },
        status: 'connected',
        lastTested: new Date('2026-02-01T10:30:00')
    },
    {
        id: '2',
        type: 's3',
        name: 'Production S3 Bucket',
        config: { bucket: 'myapp-backups', region: 'us-west-2', prefix: 'prod/' },
        status: 'connected',
        lastTested: new Date('2026-02-02T08:15:00')
    },
    {
        id: '3',
        type: 'postgresql',
        name: 'Main Database',
        config: { host: 'db.example.com', port: 5432, database: 'production' },
        status: 'connected',
        lastTested: new Date('2026-02-02T09:00:00')
    },
    {
        id: '4',
        type: 'nfs',
        name: 'NAS Storage',
        config: { host: 'nas.local', path: '/volume1/backups' },
        status: 'disconnected',
        lastTested: new Date('2026-01-28T14:20:00')
    }
];

export const mockBackupJobs = [
    {
        id: '1',
        name: 'Daily Documents Backup',
        sourceType: 'local',
        sourceConnectorId: '1',
        destinationType: 's3',
        destinationConnectorId: '2',
        schedule: '0 2 * * *',
        scheduleDescription: 'Daily at 2:00 AM',
        retention: 30,
        compression: true,
        encryption: true,
        status: 'active',
        lastRun: new Date('2026-02-02T02:00:00'),
        lastRunStatus: 'success',
        nextRun: new Date('2026-02-03T02:00:00'),
        createdAt: new Date('2026-01-15T10:00:00')
    },
    {
        id: '2',
        name: 'Database Weekly Backup',
        sourceType: 'postgresql',
        sourceConnectorId: '3',
        destinationType: 's3',
        destinationConnectorId: '2',
        schedule: '0 3 * * 0',
        scheduleDescription: 'Weekly on Sunday at 3:00 AM',
        retention: 90,
        compression: true,
        encryption: true,
        status: 'active',
        lastRun: new Date('2026-01-26T03:00:00'),
        lastRunStatus: 'success',
        nextRun: new Date('2026-02-02T03:00:00'),
        createdAt: new Date('2026-01-10T14:30:00')
    },
    {
        id: '3',
        name: 'NAS Mirror',
        sourceType: 'local',
        sourceConnectorId: '1',
        destinationType: 'nfs',
        destinationConnectorId: '4',
        schedule: '0 */6 * * *',
        scheduleDescription: 'Every 6 hours',
        retention: 7,
        compression: false,
        encryption: false,
        status: 'paused',
        lastRun: new Date('2026-01-28T12:00:00'),
        lastRunStatus: 'failed',
        nextRun: null,
        createdAt: new Date('2026-01-20T09:00:00')
    }
];

export const mockBackupHistory = [
    {
        id: 'bh1',
        jobId: '1',
        jobName: 'Daily Documents Backup',
        startTime: new Date('2026-02-02T02:00:00'),
        endTime: new Date('2026-02-02T02:15:32'),
        status: 'success',
        size: 1024 * 1024 * 256,
        filesProcessed: 1542,
        destination: 'S3: myapp-backups/prod/'
    },
    {
        id: 'bh2',
        jobId: '1',
        jobName: 'Daily Documents Backup',
        startTime: new Date('2026-02-01T02:00:00'),
        endTime: new Date('2026-02-01T02:14:18'),
        status: 'success',
        size: 1024 * 1024 * 248,
        filesProcessed: 1538,
        destination: 'S3: myapp-backups/prod/'
    },
    {
        id: 'bh3',
        jobId: '2',
        jobName: 'Database Weekly Backup',
        startTime: new Date('2026-01-26T03:00:00'),
        endTime: new Date('2026-01-26T03:45:22'),
        status: 'success',
        size: 1024 * 1024 * 1024 * 2.3,
        filesProcessed: 1,
        destination: 'S3: myapp-backups/prod/'
    },
    {
        id: 'bh4',
        jobId: '3',
        jobName: 'NAS Mirror',
        startTime: new Date('2026-01-28T12:00:00'),
        endTime: new Date('2026-01-28T12:02:45'),
        status: 'failed',
        error: 'Connection refused: NFS server unreachable',
        size: 0,
        filesProcessed: 0,
        destination: 'NFS: nas.local/volume1/backups'
    },
    {
        id: 'bh5',
        jobId: '1',
        jobName: 'Daily Documents Backup',
        startTime: new Date('2026-01-31T02:00:00'),
        endTime: new Date('2026-01-31T02:16:05'),
        status: 'success',
        size: 1024 * 1024 * 252,
        filesProcessed: 1540,
        destination: 'S3: myapp-backups/prod/'
    }
];

export const mockAvailableBackups = [
    {
        id: 'ab1',
        jobId: '1',
        jobName: 'Daily Documents Backup',
        timestamp: new Date('2026-02-02T02:00:00'),
        size: 1024 * 1024 * 256,
        encrypted: true,
        compressed: true,
        location: 's3://myapp-backups/prod/documents/2026-02-02/',
        expiresAt: new Date('2026-03-04T02:00:00')
    },
    {
        id: 'ab2',
        jobId: '1',
        jobName: 'Daily Documents Backup',
        timestamp: new Date('2026-02-01T02:00:00'),
        size: 1024 * 1024 * 248,
        encrypted: true,
        compressed: true,
        location: 's3://myapp-backups/prod/documents/2026-02-01/',
        expiresAt: new Date('2026-03-03T02:00:00')
    },
    {
        id: 'ab3',
        jobId: '2',
        jobName: 'Database Weekly Backup',
        timestamp: new Date('2026-01-26T03:00:00'),
        size: 1024 * 1024 * 1024 * 2.3,
        encrypted: true,
        compressed: true,
        location: 's3://myapp-backups/prod/database/2026-01-26/',
        expiresAt: new Date('2026-04-26T03:00:00')
    },
    {
        id: 'ab4',
        jobId: '1',
        jobName: 'Daily Documents Backup',
        timestamp: new Date('2026-01-31T02:00:00'),
        size: 1024 * 1024 * 252,
        encrypted: true,
        compressed: true,
        location: 's3://myapp-backups/prod/documents/2026-01-31/',
        expiresAt: new Date('2026-03-02T02:00:00')
    }
];

export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(start, end) {
    const ms = end - start;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}
