import { X, AlertTriangle } from 'lucide-react';

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    type = 'danger'
}) {
    if (!isOpen) return null;

    const accentColor = type === 'danger' ? 'var(--error)' : 'var(--warning)';
    const accentBg = type === 'danger' ? 'var(--error-bg)' : 'var(--warning-bg)';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-md)', textAlign: 'center' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '64px',
                        height: '64px',
                        borderRadius: 'var(--radius-full)',
                        background: accentBg,
                        color: accentColor,
                        border: `1px solid ${accentColor}`
                    }}>
                        <AlertTriangle size={32} />
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{message}</p>
                </div>

                <div className="modal-footer" style={{ justifyContent: 'center', gap: 'var(--spacing-md)' }}>
                    <button className="btn btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        style={{
                            background: accentColor,
                            borderColor: accentColor,
                            color: 'white'
                        }}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
