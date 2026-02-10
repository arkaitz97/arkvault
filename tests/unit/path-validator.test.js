import { describe, it, expect } from 'vitest';
import { validatePath, sanitizeFilename } from '../../server/utils/path-validator.js';

describe('Path Validator', () => {
    describe('validatePath', () => {
        it('should accept valid path', () => {
            expect(() => validatePath('/var/backups')).not.toThrow();
        });

        it('should reject path with .. traversal', () => {
            expect(() => validatePath('../etc/passwd')).toThrow('path traversal detected');
        });

        it('should reject path with ../ traversal', () => {
            expect(() => validatePath('../../sensitive/data')).toThrow('path traversal detected');
        });

        it('should reject null or undefined path', () => {
            expect(() => validatePath(null)).toThrow('path must be a non-empty string');
            expect(() => validatePath(undefined)).toThrow('path must be a non-empty string');
        });

        it('should reject empty path', () => {
            expect(() => validatePath('')).toThrow('path must be a non-empty string');
        });

        it('should reject non-string path', () => {
            expect(() => validatePath(123)).toThrow('path must be a non-empty string');
            expect(() => validatePath({})).toThrow('path must be a non-empty string');
        });

        it('should normalize path before validation', () => {
            const result = validatePath('/var//backups///folder');
            expect(result).toBe('/var/backups/folder');
        });

        describe('with allowed base paths', () => {
            const allowedPaths = ['/var/backups', '/home/user/data'];

            it('should accept path within allowed base', () => {
                expect(() => validatePath('/var/backups/daily', allowedPaths)).not.toThrow();
            });

            it('should reject path outside allowed base', () => {
                expect(() => validatePath('/etc/passwd', allowedPaths))
                    .toThrow('path outside allowed directories');
            });

            it('should accept relative path (no base path check)', () => {
                // Relative paths without allowed paths are accepted
                expect(() => validatePath('relative/path', allowedPaths))
                    .not.toThrow();
            });
        });
    });

    describe('sanitizeFilename', () => {
        it('should accept valid filename', () => {
            const result = sanitizeFilename('backup_2024-01-01.tar.gz');
            expect(result).toBe('backup_2024-01-01.tar.gz');
        });

        it('should replace special characters with underscore', () => {
            const result = sanitizeFilename('file with spaces.txt');
            expect(result).toBe('file_with_spaces.txt');
        });

        it('should remove path separators', () => {
            const result = sanitizeFilename('path/to/file.txt');
            expect(result).toBe('path_to_file.txt');
        });

        it('should remove dangerous characters', () => {
            const result = sanitizeFilename('file;rm -rf /.txt');
            expect(result).toBe('file_rm_-rf__.txt');
        });

        it('should reject . filename', () => {
            expect(() => sanitizeFilename('.')).toThrow('Invalid filename');
        });

        it('should reject .. filename', () => {
            expect(() => sanitizeFilename('..')).toThrow('Invalid filename');
        });

        it('should reject null or undefined filename', () => {
            expect(() => sanitizeFilename(null)).toThrow('Invalid filename');
            expect(() => sanitizeFilename(undefined)).toThrow('Invalid filename');
        });

        it('should reject empty filename', () => {
            expect(() => sanitizeFilename('')).toThrow('Invalid filename');
        });

        it('should reject non-string filename', () => {
            expect(() => sanitizeFilename(123)).toThrow('Invalid filename');
        });

        it('should preserve dots in extension', () => {
            const result = sanitizeFilename('file.tar.gz');
            expect(result).toBe('file.tar.gz');
        });

        it('should handle filename with mostly invalid characters', () => {
            // After sanitization, if result is invalid, it should throw
            const result = sanitizeFilename('***file***.txt');
            expect(result).toBe('___file___.txt');
        });
    });
});
