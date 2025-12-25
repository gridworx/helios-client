import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
    UserPlus,
    Users,
    Settings,
    Mail,
    Cloud,
    HardDrive,
    MoreHorizontal
} from 'lucide-react';

const icons: Record<string, React.ElementType> = {
    create_user: UserPlus,
    add_to_group: Users,
    google_workspace: Cloud,
    microsoft_365: HardDrive,
    send_email: Mail,
    default: Settings
};

const NodeWrapper = ({ children, selected, title, icon: Icon, color = '#64748b' }: any) => (
    <div className={`custom-node ${selected ? 'selected' : ''}`}>
        <div className="node-header" style={{ borderLeftColor: color }}>
            <div className="node-icon" style={{ backgroundColor: color }}>
                <Icon size={14} color="white" />
            </div>
            <div className="node-title">{title}</div>
            <div className="node-actions">
                <MoreHorizontal size={14} />
            </div>
        </div>
        <div className="node-body">
            {children}
        </div>
    </div>
);

export const ActionNode = memo(({ data, selected }: NodeProps) => {
    const Icon = icons[data.action as string] || icons.default;
    const color =
        (data.action as string)?.includes('google') ? '#EA4335' :
            (data.action as string)?.includes('microsoft') ? '#0078D4' :
                '#3b82f6';

    return (
        <>
            <Handle type="target" position={Position.Top} className="custom-handle" />
            <NodeWrapper
                selected={selected}
                title={data.label || 'Action'}
                icon={Icon}
                color={color}
            >
                <div className="node-content">
                    Configured
                </div>
            </NodeWrapper>
            <Handle type="source" position={Position.Bottom} className="custom-handle" />
        </>
    );
});

export const TriggerNode = memo(({ data, selected }: NodeProps) => {
    return (
        <>
            <NodeWrapper
                selected={selected}
                title={data.label || 'Start'}
                icon={Settings}
                color="#10b981"
            >
                <div className="node-content">
                    Manual Trigger
                </div>
            </NodeWrapper>
            <Handle type="source" position={Position.Bottom} className="custom-handle" />
        </>
    );
});

export const nodeStyles = `
  .custom-node {
    width: 200px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    transition: all 0.2s;
  }
  .custom-node.selected {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px #3b82f6aa;
  }
  .node-header {
    padding: 8px 12px;
    border-bottom: 1px solid #f1f5f9;
    display: flex;
    align-items: center;
    gap: 8px;
    border-left: 3px solid transparent;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }
  .node-icon {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .node-title {
    font-size: 13px;
    font-weight: 600;
    color: #1e293b;
    flex: 1;
  }
  .node-actions {
    color: #94a3b8;
    cursor: pointer;
  }
  .node-body {
    padding: 10px 12px;
    font-size: 12px;
    color: #64748b;
  }
  .custom-handle {
    width: 10px;
    height: 10px;
    background: #94a3b8;
    border: 2px solid white;
  }
`;
