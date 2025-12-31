import React, { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';
import './OrgChartTree.css';

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

type TreeOrientation = 'horizontal' | 'vertical';

interface OrgChartTreeProps {
  data: OrgNode;
  expandedNodes: Set<string>;
  selectedNode: string | null;
  searchTerm: string;
  orientation?: TreeOrientation;
  onNodeClick: (nodeId: string) => void;
  onNodeToggle: (nodeId: string) => void;
  onNodeOpen?: (node: OrgNode) => void;
}

interface OrgNodeData extends Record<string, unknown> {
  orgNode: OrgNode;
  isSelected: boolean;
  isSearchMatch: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  onOpen?: () => void;
}

// Custom node component for org chart cards
const OrgChartNode: React.FC<{ data: OrgNodeData }> = ({ data }) => {
  const { orgNode, isSelected, isSearchMatch, isExpanded, hasChildren, onToggle, onOpen } = data;

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpen) {
      onOpen();
    }
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
  };

  const getInitials = (name: string) => {
    return name.substring(0, 1).toUpperCase();
  };

  return (
    <>
      <Handle type="target" position={Position.Top} className="org-handle" />
      <div
        className={`org-node-card ${isSelected ? 'selected' : ''} ${isSearchMatch ? 'search-match' : ''}`}
        onDoubleClick={handleDoubleClick}
      >
        <div className="org-node-content">
          <div className="org-node-photo">
            {orgNode.photoUrl ? (
              <img src={orgNode.photoUrl} alt={orgNode.name} />
            ) : (
              <div className="org-node-initials">{getInitials(orgNode.name)}</div>
            )}
          </div>
          <div className="org-node-info">
            <div className="org-node-name" title={orgNode.name}>
              {orgNode.name.length > 18 ? orgNode.name.substring(0, 16) + '...' : orgNode.name}
            </div>
            <div className="org-node-title" title={orgNode.title}>
              {(orgNode.title || '').length > 20 ? (orgNode.title || '').substring(0, 18) + '...' : (orgNode.title || '')}
            </div>
            <div className="org-node-department" title={orgNode.department}>
              {(orgNode.department || '').length > 22 ? (orgNode.department || '').substring(0, 20) + '...' : (orgNode.department || '')}
            </div>
          </div>
          {orgNode.directReports.length > 0 && (
            <div className="org-node-reports-badge">
              {orgNode.directReports.length} reports
            </div>
          )}
        </div>
        {hasChildren && (
          <button
            className={`org-node-toggle ${isExpanded ? 'expanded' : 'collapsed'}`}
            onClick={handleToggleClick}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '−' : '+'}
          </button>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="org-handle" />
    </>
  );
};

const nodeTypes = {
  orgNode: OrgChartNode,
};

// Layout function using dagre
const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 200;
  const nodeHeight = 80;

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 80,
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Convert hierarchical data to flow nodes and edges
const convertToFlowElements = (
  root: OrgNode,
  expandedNodes: Set<string>,
  selectedNode: string | null,
  searchTerm: string,
  onNodeToggle: (nodeId: string) => void,
  onNodeOpen?: (node: OrgNode) => void
): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const matchesSearch = (node: OrgNode): boolean => {
    if (!searchTerm) return false;
    const term = searchTerm.toLowerCase();
    return !!(
      node.name.toLowerCase().includes(term) ||
      node.email.toLowerCase().includes(term) ||
      (node.title && node.title.toLowerCase().includes(term)) ||
      (node.department && node.department.toLowerCase().includes(term))
    );
  };

  const processNode = (node: OrgNode, parentId?: string) => {
    const isExpanded = expandedNodes.has(node.userId);

    nodes.push({
      id: node.userId,
      type: 'orgNode',
      position: { x: 0, y: 0 }, // Will be set by dagre
      data: {
        orgNode: node,
        isSelected: selectedNode === node.userId,
        isSearchMatch: matchesSearch(node),
        isExpanded,
        hasChildren: node.directReports.length > 0,
        onToggle: () => onNodeToggle(node.userId),
        onOpen: onNodeOpen ? () => onNodeOpen(node) : undefined,
      } as OrgNodeData,
    });

    if (parentId) {
      edges.push({
        id: `${parentId}-${node.userId}`,
        source: parentId,
        target: node.userId,
        type: 'smoothstep',
        style: { stroke: '#d1d5db', strokeWidth: 1 },
      });
    }

    if (isExpanded) {
      node.directReports.forEach((child) => {
        processNode(child, node.userId);
      });
    }
  };

  processNode(root);

  return { nodes, edges };
};

// Inner component that uses hooks
const OrgChartTreeInner: React.FC<OrgChartTreeProps> = ({
  data,
  expandedNodes,
  selectedNode,
  searchTerm,
  orientation = 'vertical',
  onNodeClick,
  onNodeToggle,
  onNodeOpen,
}) => {
  const { fitView } = useReactFlow();

  // Convert data to flow elements
  const { initialNodes, initialEdges } = useMemo(() => {
    const { nodes, edges } = convertToFlowElements(
      data,
      expandedNodes,
      selectedNode,
      searchTerm,
      onNodeToggle,
      onNodeOpen
    );
    const direction = orientation === 'vertical' ? 'TB' : 'LR';
    const layouted = getLayoutedElements(nodes, edges, direction);
    return { initialNodes: layouted.nodes, initialEdges: layouted.edges };
  }, [data, expandedNodes, selectedNode, searchTerm, orientation, onNodeToggle, onNodeOpen]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when data changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    // Fit view after layout updates
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 });
    }, 50);
  }, [initialNodes, initialEdges, setNodes, setEdges, fitView]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  return (
    <div className="org-chart-tree">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
        <Controls showInteractive={false} />
      </ReactFlow>
      <div className="org-chart-hints">
        <span className="org-chart-hint">Scroll to zoom, drag canvas to pan</span>
        {onNodeOpen && (
          <span className="org-chart-hint">Double-click node to open user details</span>
        )}
      </div>
    </div>
  );
};

// Wrapper component with provider
const OrgChartTree: React.FC<OrgChartTreeProps> = (props) => {
  return (
    <ReactFlowProvider>
      <OrgChartTreeInner {...props} />
    </ReactFlowProvider>
  );
};

export default OrgChartTree;
