import React from 'react';
import { ChevronRight, ChevronDown, User } from 'lucide-react';
import './OrgChartList.css';

interface OrgNode {
  userId: string;
  name: string;
  email: string;
  title: string;
  department: string;
  photoUrl?: string;
  managerId?: string;
  level: number;
  directReports: OrgNode[];
  totalReports: number;
}

interface OrgChartListProps {
  data: OrgNode;
  expandedNodes: Set<string>;
  selectedNode: string | null;
  searchTerm: string;
  onNodeClick: (nodeId: string) => void;
  onNodeToggle: (nodeId: string) => void;
}

const OrgChartList: React.FC<OrgChartListProps> = ({
  data,
  expandedNodes,
  selectedNode,
  searchTerm,
  onNodeClick,
  onNodeToggle
}) => {
  const renderNode = (node: OrgNode, level: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.userId);
    const isSelected = selectedNode === node.userId;
    const hasChildren = node.directReports.length > 0;
    const matchesSearch = searchTerm && (
      node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (node.title && node.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (node.department && node.department.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
      <div key={node.userId} className="org-list-node">
        <div
          className={`org-list-item ${isSelected ? 'selected' : ''} ${matchesSearch ? 'highlighted' : ''}`}
          style={{ paddingLeft: `${level * 24 + 12}px` }}
          onClick={() => onNodeClick(node.userId)}
        >
          {hasChildren && (
            <button
              className="expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                onNodeToggle(node.userId);
              }}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
          {!hasChildren && <div style={{ width: 20 }} />}

          <div className="user-avatar">
            {node.photoUrl ? (
              <img src={node.photoUrl} alt={node.name} />
            ) : (
              <div className="avatar-placeholder">
                <User size={16} />
              </div>
            )}
          </div>

          <div className="user-info">
            <div className="user-name">{node.name}</div>
            <div className="user-title">{node.title || 'No title'}</div>
            <div className="user-meta">
              <span>{node.email}</span>
              {node.department && <span>• {node.department}</span>}
              {hasChildren && <span className="reports-count">• {node.directReports.length} direct reports</span>}
            </div>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="org-list-children">
            {node.directReports.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="org-chart-list">
      {renderNode(data)}
    </div>
  );
};

export default OrgChartList;