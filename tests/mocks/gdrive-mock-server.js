import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 9999;
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = '/tmp/gdrive-mock-storage';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage });

app.use(express.json());

app.get('/drive/v3/about', (req, res) => {
    res.json({
        user: {
            displayName: 'Mock User',
            emailAddress: 'mock@example.com'
        }
    });
});

app.get('/drive/v3/files', (req, res) => {
    const dir = '/tmp/gdrive-mock-storage';
    if (!fs.existsSync(dir)) {
        return res.json({ files: [] });
    }
    const files = fs.readdirSync(dir).map(name => ({
        id: name,
        name: name,
        mimeType: 'application/octet-stream'
    }));
    res.json({ files });
});

app.get('/drive/v3/files/:fileId', (req, res) => {
    const { fileId } = req.params;
    const { alt } = req.query;
    const filePath = path.join('/tmp/gdrive-mock-storage', fileId);

    if (alt === 'media') {
        if (!fs.existsSync(filePath)) {
            return res.status(404).send('Not Found');
        }
        res.sendFile(filePath);
    } else {
        res.json({
            id: fileId,
            name: fileId,
            mimeType: 'application/octet-stream'
        });
    }
});

app.post('/upload/drive/v3/files', upload.single('body'), (req, res) => {
    const file = req.file;
    const metadata = JSON.parse(req.body.metadata || '{}');
    const name = metadata.name || (file ? file.originalname : 'unnamed-file');

    if (file && file.filename !== name) {
        fs.renameSync(file.path, path.join(path.dirname(file.path), name));
    }

    res.json({
        id: name,
        name: name
    });
});

app.post('/upload/drive/v3/files', (req, res) => {
    res.json({ id: 'mock-file-id', name: 'mock-file' });
});

const server = app.listen(port, () => {
});

process.on('SIGTERM', () => {
    server.close(() => {
        process.exit(0);
    });
});
