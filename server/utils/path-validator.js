import { resolve, normalize, relative } from 'path';

export function validatePath(userPath, allowedBasePaths = []) {
    if (!userPath || typeof userPath !== 'string') {
        throw new Error('Invalid path: path must be a non-empty string');
    }

    const normalizedPath = normalize(userPath);

    if (normalizedPath.includes('..')) {
        throw new Error('Invalid path: path traversal detected');
    }

    if (normalizedPath.startsWith('/') && allowedBasePaths.length > 0) {
        const isAllowed = allowedBasePaths.some(basePath => {
            const resolvedBase = resolve(basePath);
            const resolvedUser = resolve(normalizedPath);
            const rel = relative(resolvedBase, resolvedUser);
            return rel && !rel.startsWith('..') && !resolve(rel).startsWith('..');
        });

        if (!isAllowed) {
            throw new Error('Invalid path: path outside allowed directories');
        }
    }

    return normalizedPath;
}

export function sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
        throw new Error('Invalid filename');
    }

    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    if (sanitized.length === 0 || sanitized === '.' || sanitized === '..') {
        throw new Error('Invalid filename');
    }

    return sanitized;
}
