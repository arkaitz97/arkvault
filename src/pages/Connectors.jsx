import { useState, useEffect } from 'react';
import {
    PlusCircle,
    Trash2,
    Edit2,
    Check,
    X,
    RefreshCw,
    HardDrive,
    Network,
    Cloud,
    CloudCog,
    Database,
    CheckCircle2,
    XCircle,
    Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { connectorsAPI, connectorTypes, getConnectorType } from '../api';
import ConfirmationModal from '../components/ConfirmationModal';
import './Connectors.css';

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

export default function Connectors() {
    const [connectors, setConnectors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingConnector, setEditingConnector] = useState(null);
    const [testingId, setTestingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [newConnector, setNewConnector] = useState({
        type: '',
        name: '',
        config: {}
    });
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        connectorId: null,
        connectorName: ''
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

    const handleTypeSelect = (type) => {
        const typeInfo = getConnectorType(type);
        const defaultConfig = {};
        typeInfo?.fields.forEach(f => {
            if (f.default !== undefined) {
                defaultConfig[f.name] = f.default;
            }
        });
        setNewConnector({ ...newConnector, type, config: defaultConfig });
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            if (editingConnector) {
                await connectorsAPI.update(editingConnector.id, newConnector);
            } else {
                await connectorsAPI.create(newConnector);
            }
            await loadConnectors();
            closeModal();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingConnector(null);
        setNewConnector({ type: '', name: '', config: {} });
    };

    const handleEdit = (connector) => {
        setEditingConnector(connector);
        setNewConnector({
            type: connector.type,
            name: connector.name,
            config: connector.config
        });
        setShowModal(true);
    };

    const handleDelete = (connector) => {
        setConfirmModal({
            isOpen: true,
            connectorId: connector.id,
            connectorName: connector.name
        });
    };

    const confirmDelete = async () => {
        if (!confirmModal.connectorId) return;

        try {
            await connectorsAPI.delete(confirmModal.connectorId);
            await loadConnectors();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleTest = async (id) => {
        setTestingId(id);
        try {
            const result = await connectorsAPI.test(id);
            await loadConnectors();
            if (!result.success) {
                setError(`Connection failed: ${result.error}`);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setTestingId(null);
        }
    };

    if (loading) {
        return (
            <div className="connectors-page animate-fadeIn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
                <Loader2 size={48} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
        );
    }

    return (
        <div className="connectors-page animate-fadeIn">
            <header className="page-header">
                <h1>Connectors</h1>
                <p>Manage your backup sources and destinations</p>
            </header>

            <div className="actions-toolbar">
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <PlusCircle size={20} />
                    Add Connector
                </button>
            </div>

            {error && (
                <div className="card" style={{ padding: '1rem', marginBottom: '1rem', background: 'var(--error-bg)', borderColor: 'var(--error)' }}>
                    <p style={{ color: 'var(--error)', margin: 0 }}>{error}</p>
                    <button className="btn btn-ghost" style={{ marginTop: '0.5rem' }} onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}


            <section className="connector-types-section">
                <h2>Available Connector Types</h2>
                <div className="connector-types-grid">
                    {connectorTypes.map((type) => {
                        const Icon = getIcon(type.id);
                        const count = connectors.filter(c => c.type === type.id).length;
                        return (
                            <div key={type.id} className="connector-type-overview card">
                                <div className={`connector-icon ${type.id}`}>
                                    <Icon size={28} />
                                </div>
                                <div className="type-info">
                                    <span className="type-name">{type.name}</span>
                                    <span className="type-description">
                                        {type.id === 's3' ? 'AWS, MinIO, Wasabi, etc.' :
                                            type.id === 'gdrive' ? 'Service account auth' :
                                                type.id === 'postgresql' ? 'pg_dump backup' :
                                                    type.id === 'nfs' ? 'Network file share' : 'Local filesystem'}
                                    </span>
                                </div>
                                <div className="type-stats">
                                    <span className="type-count">{count}</span>
                                    <span className="type-label">configured</span>
                                </div>
                                <div className="type-capabilities">
                                    {type.canBeSource && <span className="capability source">Source</span>}
                                    {type.canBeDestination && <span className="capability dest">Destination</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>


            <section className="configured-section">
                <h2>Configured Connectors</h2>

                {connectors.length === 0 ? (
                    <div className="empty-state card">
                        <Database size={64} />
                        <h3>No Connectors Configured</h3>
                        <p>Add your first connector to start creating backup jobs</p>
                        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                            <PlusCircle size={20} />
                            Add Connector
                        </button>
                    </div>
                ) : (
                    <div className="connectors-list">
                        {connectors.map((connector) => {
                            const Icon = getIcon(connector.type);
                            const typeInfo = getConnectorType(connector.type);
                            return (
                                <div key={connector.id} className="connector-item card">
                                    <div className={`connector-icon ${connector.type}`}>
                                        <Icon size={24} />
                                    </div>

                                    <div className="connector-info">
                                        <span className="connector-name">{connector.name}</span>
                                        <span className="connector-type-label">{typeInfo?.name}</span>
                                    </div>

                                    <div className="connector-status">
                                        {connector.status === 'connected' ? (
                                            <span className="status-badge connected">
                                                <CheckCircle2 size={14} />
                                                Connected
                                            </span>
                                        ) : (
                                            <span className="status-badge disconnected">
                                                <XCircle size={14} />
                                                Disconnected
                                            </span>
                                        )}
                                        {connector.last_tested && (
                                            <span className="last-tested">
                                                Last tested: {format(new Date(connector.last_tested), 'MMM d, HH:mm')}
                                            </span>
                                        )}
                                    </div>

                                    <div className="connector-actions">
                                        <button
                                            className="btn btn-icon btn-ghost"
                                            onClick={() => handleTest(connector.id)}
                                            disabled={testingId === connector.id}
                                            title="Test connection"
                                        >
                                            <RefreshCw
                                                size={18}
                                                className={testingId === connector.id ? 'animate-spin' : ''}
                                            />
                                        </button>
                                        <button
                                            className="btn btn-icon btn-ghost"
                                            onClick={() => handleEdit(connector)}
                                            title="Edit"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            className="btn btn-icon btn-ghost danger"
                                            onClick={() => handleDelete(connector)}
                                            title="Delete"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>


            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingConnector ? 'Edit Connector' : 'Add New Connector'}</h3>
                            <button className="btn btn-icon btn-ghost" onClick={closeModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            {!editingConnector && !newConnector.type ? (
                                <div className="type-selection">
                                    <p>Select connector type:</p>
                                    <div className="type-grid">
                                        {connectorTypes.map((type) => {
                                            const Icon = getIcon(type.id);
                                            return (
                                                <button
                                                    key={type.id}
                                                    className="type-option"
                                                    onClick={() => handleTypeSelect(type.id)}
                                                >
                                                    <div className={`connector-icon ${type.id}`}>
                                                        <Icon size={24} />
                                                    </div>
                                                    <span>{type.name}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="connector-form">
                                    <div className="form-header">
                                        <div className={`connector-icon ${newConnector.type}`}>
                                            {(() => {
                                                const Icon = getIcon(newConnector.type);
                                                return <Icon size={24} />;
                                            })()}
                                        </div>
                                        <span>{getConnectorType(newConnector.type)?.name}</span>
                                    </div>

                                    <div className="input-group">
                                        <label>Connector Name <span className="required">*</span></label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="e.g., Production Database"
                                            value={newConnector.name}
                                            onChange={(e) => setNewConnector({ ...newConnector, name: e.target.value })}
                                        />
                                    </div>

                                    {getConnectorType(newConnector.type)?.fields.map(field => (
                                        <div key={field.name} className="input-group">
                                            <label>
                                                {field.label}
                                                {field.required && <span className="required">*</span>}
                                            </label>
                                            {field.type === 'textarea' ? (
                                                <textarea
                                                    className="input"
                                                    placeholder={field.placeholder}
                                                    rows={4}
                                                    value={newConnector.config[field.name] || ''}
                                                    onChange={(e) => setNewConnector({
                                                        ...newConnector,
                                                        config: { ...newConnector.config, [field.name]: e.target.value }
                                                    })}
                                                />
                                            ) : field.type === 'checkbox' ? (
                                                <label className="checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={newConnector.config[field.name] ?? field.default ?? false}
                                                        onChange={(e) => setNewConnector({
                                                            ...newConnector,
                                                            config: { ...newConnector.config, [field.name]: e.target.checked }
                                                        })}
                                                    />
                                                    <span>Enable</span>
                                                </label>
                                            ) : (
                                                <input
                                                    type={field.type}
                                                    className="input"
                                                    placeholder={field.placeholder}
                                                    value={newConnector.config[field.name] || ''}
                                                    onChange={(e) => setNewConnector({
                                                        ...newConnector,
                                                        config: { ...newConnector.config, [field.name]: e.target.value }
                                                    })}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={closeModal}>
                                Cancel
                            </button>
                            {newConnector.type && (
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSave}
                                    disabled={!newConnector.name || saving}
                                >
                                    {saving ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <Check size={18} />
                                    )}
                                    {editingConnector ? 'Save Changes' : 'Add Connector'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmDelete}
                title="Delete Connector"
                message={`Are you sure you want to delete "${confirmModal.connectorName}"? Strategies that depend on it may fail.`}
                confirmText="Delete Connector"
                type="danger"
            />
        </div>
    );
}
