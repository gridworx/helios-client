import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './ui.css';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'small' | 'medium' | 'large';
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
}

/**
 * Modal Base Component
 *
 * Reusable modal dialog following Helios design system.
 *
 * @example
 * ```tsx
 * <Modal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   title="Edit User"
 *   size="medium"
 *   closeOnBackdrop={true}
 * >
 *   <div>Modal content here</div>
 * </Modal>
 * ```
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'medium',
  closeOnBackdrop = true,
  children
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="helios-modal-overlay"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        ref={modalRef}
        className={`helios-modal-content size-${size}`}
      >
        {title && (
          <div className="helios-modal-header">
            <h2 id="modal-title" className="helios-modal-title">
              {title}
            </h2>
            <button
              className="helios-modal-close"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="helios-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};
