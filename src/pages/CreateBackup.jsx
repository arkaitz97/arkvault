import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    HardDrive,
    Network,
    Cloud,
    CloudCog,
    Database,
    Clock,
    Shield,
    Archive,
    Loader2
} from 'lucide-react';
import { connectorsAPI, jobsAPI, connectorTypes, getConnectorType } from '../api';
import './CreateBackup.css';

const steps = [
    { id: 1, title: 'Source', description: 'Select backup source' },
    { id: 2, title: 'Destination', description: 'Choose where to store' },
    { id: 3, title: 'Schedule', description: 'Set backup schedule' },
    { id: 4, title: 'Options', description: 'Configure settings' },
    { id: 5, title: 'Review', description: 'Confirm and create' }
];

const getIcon = (type) => {
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
    { id: 'custom', label: 'Custom', cron: '', description: 'Define custom schedule' }
];

export default function CreateBackup() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [connectors, setConnectors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        sourceType: '',
        sourceConnectorId: '',
        sourceConfig: {},
        destinationType: '',
        destinationConnectorId: '',
        destinationConfig: {},
        schedule: 'daily',
        customCron: '',
        retention: 30,
        compression: true,
        encryption: true
    });

    useEffect(() => {
        loadConnectors();
    }, []);

    const loadConnectors = async () => {
        try {
            setLoading(true);
            const data = await connectorsAPI.getAll();
            setConnectors(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const sourceConnectorTypes = connectorTypes.filter(c => c.canBeSource);
    const destConnectorTypes = connectorTypes.filter(c => c.canBeDestination);

    const getExistingConnectors = (type, isSource) => {
        const typeInfo = getConnectorType(type);
        return connectors.filter(c =>
            c.type === type &&
            typeInfo && typeInfo[isSource ? 'canBeSource' : 'canBeDestination']
        );
    };

    const handleNext = () => {
        if (currentStep < steps.length) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSubmit = async () => {
        try {
            setSaving(true);
            const selectedSchedule = schedulePresets.find(s => s.id === formData.schedule);
            const cronExpression = formData.schedule === 'custom' ? formData.customCron : selectedSchedule?.cron;

            await jobsAPI.create({
                name: formData.name,
                source_type: formData.sourceType,
                source_connector_id: formData.sourceConnectorId || null,
                source_config: formData.sourceConnectorId ? null : formData.sourceConfig,
                destination_type: formData.destinationType,
                destination_connector_id: formData.destinationConnectorId || null,
                destination_config: formData.destinationConnectorId ? null : formData.destinationConfig,
                schedule: cronExpression,
                schedule_description: formData.schedule === 'custom' ? 'Custom schedule' : selectedSchedule?.description,
                retention: formData.retention,
                compression: formData.compression,
                encryption: formData.encryption
            });

            navigate('/jobs');
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const canProceed = () => {
        switch (currentStep) {
            case 1:
                return formData.sourceType && (formData.sourceConnectorId || Object.keys(formData.sourceConfig).length > 0);
            case 2:
                return formData.destinationType && (formData.destinationConnectorId || Object.keys(formData.destinationConfig).length > 0);
            case 3:
                return formData.schedule && (formData.schedule !== 'custom' || formData.customCron);
            case 4:
                return formData.name;
            case 5:
                return true;
            default:
                return false;
        }
    };

    if (loading) {
        return (
            <div className="create-backup animate-fadeIn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
                <Loader2 size={48} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
        );
    }

    const renderSourceStep = () => (
        <div className="step-content">
            <h2>Select Backup Source</h2>
            <p>Choose what you want to backup</p>

            <div className="connector-type-grid">
                {sourceConnectorTypes.map((type) => {
                    const Icon = getIcon(type.id);
                    return (
                        <button
                            key={type.id}
                            className={`connector-type-card ${formData.sourceType === type.id ? 'selected' : ''}`}
                            onClick={() => setFormData({
                                ...formData,
                                sourceType: type.id,
                                sourceConnectorId: '',
                                sourceConfig: {}
                            })}
                        >
                            <div className={`connector-icon ${type.id}`}>
                                <Icon size={28} />
                            </div>
                            <span className="type-name">{type.name}</span>
                            <span className="type-description">
                                {type.id === 's3' ? 'AWS, MinIO, Wasabi' :
                                    type.id === 'gdrive' ? 'Google Drive files' :
                                        type.id === 'postgresql' ? 'Database backup' :
                                            type.id === 'nfs' ? 'Network share' : 'Local files'}
                            </span>
                        </button>
                    );
                })}
            </div>

            {formData.sourceType && (
                <div className="connector-config animate-slideUp">
                    <h3>Configure {getConnectorType(formData.sourceType)?.name}</h3>

                    {getExistingConnectors(formData.sourceType, true).length > 0 && (
                        <div className="existing-connectors">
                            <label>Use existing connector:</label>
                            <div className="existing-list">
                                {getExistingConnectors(formData.sourceType, true).map(conn => (
                                    <button
                                        key={conn.id}
                                        className={`existing-item ${formData.sourceConnectorId === conn.id ? 'selected' : ''}`}
                                        onClick={() => setFormData({ ...formData, sourceConnectorId: conn.id })}
                                    >
                                        <span>{conn.name}</span>
                                        {formData.sourceConnectorId === conn.id && <Check size={16} />}
                                    </button>
                                ))}
                            </div>
                            <div className="divider">
                                <span>or configure new</span>
                            </div>
                        </div>
                    )}

                    <div className="config-fields">
                        {getConnectorType(formData.sourceType)?.fields.map(field => (
                            <div key={field.name} className="input-group">
                                <label>{field.label} {field.required && <span className="required">*</span>}</label>
                                {field.type === 'textarea' ? (
                                    <textarea
                                        className="input"
                                        placeholder={field.placeholder}
                                        value={formData.sourceConfig[field.name] || ''}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            sourceConnectorId: '',
                                            sourceConfig: { ...formData.sourceConfig, [field.name]: e.target.value }
                                        })}
                                        rows={4}
                                    />
                                ) : field.type === 'checkbox' ? (
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={formData.sourceConfig[field.name] ?? field.default ?? false}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                sourceConnectorId: '',
                                                sourceConfig: { ...formData.sourceConfig, [field.name]: e.target.checked }
                                            })}
                                        />
                                        <span>Enable</span>
                                    </label>
                                ) : (
                                    <input
                                        type={field.type}
                                        className="input"
                                        placeholder={field.placeholder}
                                        value={formData.sourceConfig[field.name] || ''}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            sourceConnectorId: '',
                                            sourceConfig: { ...formData.sourceConfig, [field.name]: e.target.value }
                                        })}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const renderDestinationStep = () => (
        <div className="step-content">
            <h2>Select Destination</h2>
            <p>Choose where to store your backups</p>

            <div className="connector-type-grid">
                {destConnectorTypes.map((type) => {
                    const Icon = getIcon(type.id);
                    return (
                        <button
                            key={type.id}
                            className={`connector-type-card ${formData.destinationType === type.id ? 'selected' : ''}`}
                            onClick={() => setFormData({
                                ...formData,
                                destinationType: type.id,
                                destinationConnectorId: '',
                                destinationConfig: {}
                            })}
                        >
                            <div className={`connector-icon ${type.id}`}>
                                <Icon size={28} />
                            </div>
                            <span className="type-name">{type.name}</span>
                            <span className="type-description">
                                {type.id === 's3' ? 'AWS, MinIO, Wasabi' :
                                    type.id === 'gdrive' ? 'Google Drive' :
                                        type.id === 'nfs' ? 'Network share' : 'Local folder'}
                            </span>
                        </button>
                    );
                })}
            </div>

            {formData.destinationType && (
                <div className="connector-config animate-slideUp">
                    <h3>Configure {getConnectorType(formData.destinationType)?.name}</h3>

                    {getExistingConnectors(formData.destinationType, false).length > 0 && (
                        <div className="existing-connectors">
                            <label>Use existing connector:</label>
                            <div className="existing-list">
                                {getExistingConnectors(formData.destinationType, false).map(conn => (
                                    <button
                                        key={conn.id}
                                        className={`existing-item ${formData.destinationConnectorId === conn.id ? 'selected' : ''}`}
                                        onClick={() => setFormData({ ...formData, destinationConnectorId: conn.id })}
                                    >
                                        <span>{conn.name}</span>
                                        {formData.destinationConnectorId === conn.id && <Check size={16} />}
                                    </button>
                                ))}
                            </div>
                            <div className="divider">
                                <span>or configure new</span>
                            </div>
                        </div>
                    )}

                    <div className="config-fields">
                        {getConnectorType(formData.destinationType)?.fields.map(field => (
                            <div key={field.name} className="input-group">
                                <label>{field.label} {field.required && <span className="required">*</span>}</label>
                                {field.type === 'textarea' ? (
                                    <textarea
                                        className="input"
                                        placeholder={field.placeholder}
                                        value={formData.destinationConfig[field.name] || ''}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            destinationConnectorId: '',
                                            destinationConfig: { ...formData.destinationConfig, [field.name]: e.target.value }
                                        })}
                                        rows={4}
                                    />
                                ) : field.type === 'checkbox' ? (
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={formData.destinationConfig[field.name] ?? field.default ?? false}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                destinationConnectorId: '',
                                                destinationConfig: { ...formData.destinationConfig, [field.name]: e.target.checked }
                                            })}
                                        />
                                        <span>Enable</span>
                                    </label>
                                ) : (
                                    <input
                                        type={field.type}
                                        className="input"
                                        placeholder={field.placeholder}
                                        value={formData.destinationConfig[field.name] || ''}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            destinationConnectorId: '',
                                            destinationConfig: { ...formData.destinationConfig, [field.name]: e.target.value }
                                        })}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const renderScheduleStep = () => (
        <div className="step-content">
            <h2>Set Backup Schedule</h2>
            <p>When should backups run?</p>

            <div className="schedule-grid">
                {schedulePresets.map((preset) => (
                    <button
                        key={preset.id}
                        className={`schedule-card ${formData.schedule === preset.id ? 'selected' : ''}`}
                        onClick={() => setFormData({ ...formData, schedule: preset.id })}
                    >
                        <Clock size={24} />
                        <span className="schedule-label">{preset.label}</span>
                        <span className="schedule-description">{preset.description}</span>
                    </button>
                ))}
            </div>

            {formData.schedule === 'custom' && (
                <div className="custom-cron animate-slideUp">
                    <div className="input-group">
                        <label>Cron Expression</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="* * * * *"
                            value={formData.customCron}
                            onChange={(e) => setFormData({ ...formData, customCron: e.target.value })}
                        />
                        <span className="input-hint">Format: minute hour day-of-month month day-of-week</span>
                    </div>
                </div>
            )}
        </div>
    );

    const renderOptionsStep = () => (
        <div className="step-content">
            <h2>Configure Options</h2>
            <p>Set backup preferences and retention policy</p>

            <div className="options-form">
                <div className="input-group">
                    <label>Backup Job Name <span className="required">*</span></label>
                    <input
                        type="text"
                        className="input"
                        placeholder="e.g., Daily Documents Backup"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>

                <div className="input-group">
                    <label>Retention Period (days)</label>
                    <input
                        type="number"
                        className="input"
                        min="1"
                        max="365"
                        value={formData.retention}
                        onChange={(e) => setFormData({ ...formData, retention: parseInt(e.target.value) })}
                    />
                    <span className="input-hint">Backups older than this will be automatically deleted</span>
                </div>

                <div className="toggle-options">
                    <label className="toggle-option">
                        <div className="toggle-info">
                            <Archive size={20} />
                            <div>
                                <span className="toggle-label">Compression</span>
                                <span className="toggle-description">Reduce backup size with gzip compression</span>
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={formData.compression}
                            onChange={(e) => setFormData({ ...formData, compression: e.target.checked })}
                        />
                        <span className="toggle-switch"></span>
                    </label>

                    <label className="toggle-option">
                        <div className="toggle-info">
                            <Shield size={20} />
                            <div>
                                <span className="toggle-label">Encryption</span>
                                <span className="toggle-description">Encrypt backups with AES-256</span>
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={formData.encryption}
                            onChange={(e) => setFormData({ ...formData, encryption: e.target.checked })}
                        />
                        <span className="toggle-switch"></span>
                    </label>
                </div>
            </div>
        </div>
    );

    const renderReviewStep = () => {
        const SourceIcon = formData.sourceType ? getIcon(formData.sourceType) : null;
        const DestIcon = formData.destinationType ? getIcon(formData.destinationType) : null;
        const selectedSchedule = schedulePresets.find(s => s.id === formData.schedule);

        return (
            <div className="step-content">
                <h2>Review & Create</h2>
                <p>Review your backup job configuration</p>

                {error && (
                    <div style={{ padding: '1rem', marginBottom: '1rem', background: 'var(--error-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--error)' }}>
                        <p style={{ color: 'var(--error)', margin: 0 }}>{error}</p>
                    </div>
                )}

                <div className="review-summary">
                    <div className="review-section">
                        <h4>General</h4>
                        <div className="review-item">
                            <span className="review-label">Name:</span>
                            <span className="review-value">{formData.name}</span>
                        </div>
                    </div>

                    <div className="review-section">
                        <h4>Source</h4>
                        <div className="review-item">
                            <span className="review-label">Type:</span>
                            <span className="review-value flex items-center gap-sm">
                                {SourceIcon && <SourceIcon size={16} />}
                                {getConnectorType(formData.sourceType)?.name}
                            </span>
                        </div>
                        {formData.sourceConnectorId && (
                            <div className="review-item">
                                <span className="review-label">Connector:</span>
                                <span className="review-value">{connectors.find(c => c.id === formData.sourceConnectorId)?.name}</span>
                            </div>
                        )}
                    </div>

                    <div className="review-section">
                        <h4>Destination</h4>
                        <div className="review-item">
                            <span className="review-label">Type:</span>
                            <span className="review-value flex items-center gap-sm">
                                {DestIcon && <DestIcon size={16} />}
                                {getConnectorType(formData.destinationType)?.name}
                            </span>
                        </div>
                        {formData.destinationConnectorId && (
                            <div className="review-item">
                                <span className="review-label">Connector:</span>
                                <span className="review-value">{connectors.find(c => c.id === formData.destinationConnectorId)?.name}</span>
                            </div>
                        )}
                    </div>

                    <div className="review-section">
                        <h4>Schedule & Options</h4>
                        <div className="review-item">
                            <span className="review-label">Schedule:</span>
                            <span className="review-value">
                                {formData.schedule === 'custom' ? formData.customCron : selectedSchedule?.description}
                            </span>
                        </div>
                        <div className="review-item">
                            <span className="review-label">Retention:</span>
                            <span className="review-value">{formData.retention} days</span>
                        </div>
                        <div className="review-item">
                            <span className="review-label">Compression:</span>
                            <span className="review-value">{formData.compression ? 'Enabled' : 'Disabled'}</span>
                        </div>
                        <div className="review-item">
                            <span className="review-label">Encryption:</span>
                            <span className="review-value">{formData.encryption ? 'Enabled' : 'Disabled'}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="create-backup animate-fadeIn">
            <header className="page-header">
                <h1>Create Backup Job</h1>
                <p>Set up a new automated backup</p>
            </header>

            {/* Progress Steps */}
            <div className="steps-progress">
                {steps.map((step, index) => (
                    <div
                        key={step.id}
                        className={`step ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}
                    >
                        <div className="step-indicator">
                            {currentStep > step.id ? <Check size={16} /> : step.id}
                        </div>
                        <div className="step-info">
                            <span className="step-title">{step.title}</span>
                            <span className="step-description">{step.description}</span>
                        </div>
                        {index < steps.length - 1 && <div className="step-connector" />}
                    </div>
                ))}
            </div>

            {/* Step Content */}
            <div className="step-container card">
                {currentStep === 1 && renderSourceStep()}
                {currentStep === 2 && renderDestinationStep()}
                {currentStep === 3 && renderScheduleStep()}
                {currentStep === 4 && renderOptionsStep()}
                {currentStep === 5 && renderReviewStep()}

                {/* Navigation */}
                <div className="step-navigation">
                    <button
                        className="btn btn-secondary"
                        onClick={handleBack}
                        disabled={currentStep === 1}
                    >
                        <ArrowLeft size={18} />
                        Back
                    </button>

                    {currentStep < steps.length ? (
                        <button
                            className="btn btn-primary"
                            onClick={handleNext}
                            disabled={!canProceed()}
                        >
                            Next
                            <ArrowRight size={18} />
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary"
                            onClick={handleSubmit}
                            disabled={saving}
                        >
                            {saving ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Check size={18} />
                            )}
                            Create Backup Job
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
