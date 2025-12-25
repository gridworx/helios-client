import React from 'react';
// Note: Uses native HTML drag-and-drop, not @dnd-kit
import {
    UserPlus,
    Users,
    Settings,
    Mail,
    Calendar,
    Cloud,
    HardDrive
} from 'lucide-react';

export const Sidebar = () => {
    const onDragStart = (event: React.DragEvent, nodeType: string, payload?: any) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        if (payload) {
            event.dataTransfer.setData('application/payload', JSON.stringify(payload));
        }
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <aside className="workflow-sidebar">
            <div className="sidebar-section">
                <h3>Triggers</h3>
                <div
                    className="dndnode input"
                    onDragStart={(event) => onDragStart(event, 'trigger', { label: 'Manual Start' })}
                    draggable
                >
                    <Settings size={16} />
                    Manual Start
                </div>
                <div
                    className="dndnode input"
                    onDragStart={(event) => onDragStart(event, 'trigger', { label: 'On Hire Date' })}
                    draggable
                >
                    <Calendar size={16} />
                    On Hire Date
                </div>
            </div>

            <div className="sidebar-section">
                <h3>Identity Actions</h3>
                <div
                    className="dndnode"
                    onDragStart={(event) => onDragStart(event, 'action', { action: 'create_user', label: 'Create User' })}
                    draggable
                >
                    <UserPlus size={16} />
                    Create User
                </div>
                <div
                    className="dndnode"
                    onDragStart={(event) => onDragStart(event, 'action', { action: 'add_to_group', label: 'Add to Group' })}
                    draggable
                >
                    <Users size={16} />
                    Add to Group
                </div>
            </div>

            <div className="sidebar-section">
                <h3>Integrations</h3>
                <div
                    className="dndnode"
                    onDragStart={(event) => onDragStart(event, 'action', { action: 'google_workspace', label: 'Google Workspace' })}
                    draggable
                >
                    <Cloud size={16} />
                    Google Workspace
                </div>
                <div
                    className="dndnode"
                    onDragStart={(event) => onDragStart(event, 'action', { action: 'microsoft_365', label: 'Microsoft 365' })}
                    draggable
                >
                    <HardDrive size={16} />
                    Microsoft 365
                </div>
            </div>

            <div className="sidebar-section">
                <h3>Utilities</h3>
                <div
                    className="dndnode"
                    onDragStart={(event) => onDragStart(event, 'action', { action: 'send_email', label: 'Send Email' })}
                    draggable
                >
                    <Mail size={16} />
                    Send Email
                </div>
            </div>

            <style>{`
        .workflow-sidebar {
          width: 250px;
          border-right: 1px solid #e2e8f0;
          padding: 20px;
          background: #f8fafc;
          font-size: 14px;
        }
        .sidebar-section {
          margin-bottom: 24px;
        }
        .sidebar-section h3 {
          font-size: 12px;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 600;
          margin-bottom: 12px;
          letter-spacing: 0.05em;
        }
        .dndnode {
          padding: 10px 12px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: white;
          cursor: grab;
          transition: all 0.2s;
          color: #334155;
          font-weight: 500;
        }
        .dndnode:hover {
          border-color: #cbd5e1;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .dndnode.input {
          border-left: 3px solid #3b82f6;
        }
      `}</style>
        </aside>
    );
};
