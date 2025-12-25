import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { Modal } from './Modal';
import './ui.css';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * ConfirmDialog Component
 *
 * Confirmation dialog with variant support for different types of actions.
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   isOpen={showConfirm}
 *   title="Delete User"
 *   message="Are you sure you want to delete this user? This action cannot be undone."
 *   variant="danger"
 *   confirmText="Delete"
 *   cancelText="Cancel"
 *   onConfirm={handleDelete}
 *   onCancel={() => setShowConfirm(false)}
 * />
 * ```
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info',
  icon,
  onConfirm,
  onCancel
}) => {
  // Default icons based on variant
  const getDefaultIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertCircle size={20} />;
      case 'warning':
        return <AlertTriangle size={20} />;
      case 'success':
        return <CheckCircle size={20} />;
      case 'info':
      default:
        return <Info size={20} />;
    }
  };

  const displayIcon = icon || getDefaultIcon();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      size="small"
      closeOnBackdrop={false}
    >
      <div className="helios-confirm-dialog">
        <div className="helios-confirm-header">
          <div className={`helios-confirm-icon variant-${variant}`}>
            {displayIcon}
          </div>
          <div className="helios-confirm-content">
            <h3>{title}</h3>
            <p>{message}</p>
          </div>
        </div>

        <div className="helios-confirm-actions">
          <button
            className="helios-btn helios-btn-secondary"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            className={`helios-btn helios-btn-${variant}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
