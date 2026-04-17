import Modal from './Modal';

interface ConfirmModalProps {
  open: boolean;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open, message, confirmLabel = 'Delete', danger = true, onConfirm, onCancel,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onCancel} maxWidth={360}>
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--text)', lineHeight: 1.5 }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end', marginTop: 'var(--sp-4)' }}>
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button
          className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
