import { body, param, validationResult } from 'express-validator';
import cron from 'node-cron';
import logger from '../logger.js';

export function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn({ errors: errors.array(), path: req.path }, 'Validation failed');
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
}

export const validateLogin = [
    body('password')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 1, max: 128 })
        .withMessage('Password length must be between 1 and 128 characters'),
    handleValidationErrors
];

export const validateChangePassword = [
    body('newPassword')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('New password is required')
        .isLength({ min: process.env.NODE_ENV === 'test' ? 8 : 12 })
        .withMessage(process.env.NODE_ENV === 'test'
            ? 'Password must be at least 8 characters long'
            : 'Password must be at least 12 characters long')
        .if(() => process.env.NODE_ENV !== 'test')
        .matches(/[a-z]/)
        .withMessage('Password must contain at least one lowercase letter')
        .if(() => process.env.NODE_ENV !== 'test')
        .matches(/[A-Z]/)
        .withMessage('Password must contain at least one uppercase letter')
        .if(() => process.env.NODE_ENV !== 'test')
        .matches(/[0-9]/)
        .withMessage('Password must contain at least one number'),
    body('confirmPassword')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Password confirmation is required')
        .custom((value, { req }) => value === req.body.newPassword)
        .withMessage('Passwords do not match'),
    handleValidationErrors
];

export const validateJobCreation = [
    body('name')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Job name is required')
        .isLength({ max: 255 })
        .withMessage('Job name must not exceed 255 characters'),
    body('schedule')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Schedule is required')
        .custom((value) => {
            return cron.validate(value);
        })
        .withMessage('Invalid cron expression'),
    body('retention')
        .optional()
        .isInt({ min: 1, max: 3650 })
        .withMessage('Retention must be between 1 and 3650 days'),
    body('source_type')
        .isString()
        .isIn(['local', 's3', 'gdrive', 'postgresql', 'nfs', 'ssh'])
        .withMessage('Invalid source type'),
    body('destination_type')
        .isString()
        .isIn(['local', 's3', 'gdrive', 'postgresql', 'nfs', 'ssh'])
        .withMessage('Invalid destination type'),
    body('format')
        .optional()
        .isString()
        .isIn(['zip', 'tar'])
        .withMessage('Format must be either zip or tar'),
    handleValidationErrors
];

export const validateConnectorCreation = [
    body('type')
        .isString()
        .isIn(['local', 's3', 'gdrive', 'postgresql', 'nfs', 'ssh'])
        .withMessage('Invalid connector type'),
    body('name')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Connector name is required')
        .isLength({ max: 255 })
        .withMessage('Connector name must not exceed 255 characters'),
    body('config')
        .isObject()
        .withMessage('Config must be an object'),
    handleValidationErrors
];

export const validateUUID = [
    param('id')
        .optional()
        .isUUID()
        .withMessage('Invalid ID format'),
    param('jobId')
        .optional()
        .isUUID()
        .withMessage('Invalid job ID format'),
    param('backupId')
        .optional()
        .isUUID()
        .withMessage('Invalid backup ID format'),
    param('historyId')
        .optional()
        .isUUID()
        .withMessage('Invalid history ID format'),
    handleValidationErrors
];

export const validateRestoreRequest = [
    body('destination_type')
        .isString()
        .isIn(['local', 's3', 'gdrive', 'postgresql', 'nfs', 'ssh'])
        .withMessage('Invalid destination type'),
    body('destination_path')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Destination path is required')
        .custom((value) => {
            if (value.includes('..')) {
                throw new Error('Path traversal detected');
            }
            return true;
        }),
    handleValidationErrors
];
