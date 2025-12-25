import { useState, useEffect, useRef } from 'react';
import { X, Check, GripVertical } from 'lucide-react';
import './ColumnSelector.css';

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  required?: boolean; // Cannot be hidden
}

interface ColumnSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
  storageKey?: string; // localStorage key for persistence
}

export function ColumnSelector({
  isOpen,
  onClose,
  columns,
  onColumnsChange,
  storageKey = 'helios_user_columns'
}: ColumnSelectorProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>(columns);

  // Load saved preferences on mount
  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const savedVisibility = JSON.parse(saved) as Record<string, boolean>;
          const updatedColumns = columns.map(col => ({
            ...col,
            visible: savedVisibility[col.key] ?? col.visible
          }));
          setLocalColumns(updatedColumns);
          onColumnsChange(updatedColumns);
        } catch {
          // Invalid saved data, use defaults
        }
      }
    }
  }, [storageKey]);

  // Sync with parent columns prop
  useEffect(() => {
    setLocalColumns(columns);
  }, [columns]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleToggleColumn = (key: string) => {
    const column = localColumns.find(c => c.key === key);
    if (!column || column.required) return;

    const updatedColumns = localColumns.map(col =>
      col.key === key ? { ...col, visible: !col.visible } : col
    );

    setLocalColumns(updatedColumns);
    onColumnsChange(updatedColumns);

    // Save to localStorage
    if (storageKey) {
      const visibility = updatedColumns.reduce((acc, col) => {
        acc[col.key] = col.visible;
        return acc;
      }, {} as Record<string, boolean>);
      localStorage.setItem(storageKey, JSON.stringify(visibility));
    }
  };

  const resetToDefaults = () => {
    const defaultColumns = columns.map(col => ({
      ...col,
      visible: true
    }));
    setLocalColumns(defaultColumns);
    onColumnsChange(defaultColumns);

    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  };

  const visibleCount = localColumns.filter(c => c.visible).length;
  const totalCount = localColumns.length;

  if (!isOpen) return null;

  return (
    <div className="column-selector" ref={panelRef}>
      <div className="column-selector-header">
        <h3>Edit Columns</h3>
        <div className="column-selector-actions">
          <button className="btn-reset-columns" onClick={resetToDefaults}>
            Reset
          </button>
          <button className="btn-close-selector" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="column-selector-info">
        <span>{visibleCount} of {totalCount} columns visible</span>
      </div>

      <div className="column-selector-list">
        {localColumns.map(column => (
          <label
            key={column.key}
            className={`column-item ${column.visible ? 'visible' : ''} ${column.required ? 'required' : ''}`}
          >
            <div className="column-item-left">
              <GripVertical size={14} className="drag-handle" />
              <input
                type="checkbox"
                checked={column.visible}
                onChange={() => handleToggleColumn(column.key)}
                disabled={column.required}
              />
              <span className="column-label">{column.label}</span>
            </div>
            {column.required && (
              <span className="required-badge">Required</span>
            )}
            {column.visible && !column.required && (
              <Check size={14} className="check-icon" />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
