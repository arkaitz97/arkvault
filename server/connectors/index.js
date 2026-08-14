import LocalConnector from './local.js';
import S3Connector from './s3.js';
import GDriveConnector from './gdrive.js';
import PostgreSQLConnector from './postgresql.js';
import NFSConnector from './nfs.js';
import SSHConnector from './ssh.js';

const connectors = {
    local: new LocalConnector(),
    s3: new S3Connector(),
    gdrive: new GDriveConnector(),
    postgresql: new PostgreSQLConnector(),
    nfs: new NFSConnector(),
    ssh: new SSHConnector()
};

export function getConnector(type) {
    const connector = connectors[type];
    if (!connector) {
        throw new Error(`Unknown connector type: ${type}`);
    }
    return connector;
}

export default connectors;
