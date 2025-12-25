import React, { useState, useRef, useCallback } from 'react';
import type {
    Connection,
    Edge,
    Node
} from '@xyflow/react';
import {
    ReactFlow,
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Sidebar } from '../components/workflow/Sidebar';
import { ActionNode, TriggerNode, nodeStyles } from '../components/workflow/CustomNodes';
import { Save, Play } from 'lucide-react';

const nodeTypes = {
    action: ActionNode,
    trigger: TriggerNode,
};

const initialNodes: Node[] = [
    {
        id: '1',
        type: 'trigger',
        data: { label: 'Manual Start' },
        position: { x: 250, y: 5 },
    },
];

let id = 0;
const getId = () => `dndnode_${id++}`;

import { useNavigate, useParams } from 'react-router-dom';
import type { Workflow } from '../services/workflows.service';
import { workflowsService } from '../services/workflows.service';
// import { toast } from 'react-hot-toast'; 

// ... (imports)

const WorkflowBuilderContent = () => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

    // Router hooks
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [_workflow, setWorkflow] = useState<Workflow | null>(null);
    const [name, setName] = useState('New Workflow');

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            const payloadStr = event.dataTransfer.getData('application/payload');
            const payload = payloadStr ? JSON.parse(payloadStr) : {};

            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode: Node = {
                id: getId(),
                type,
                position,
                data: { ...payload },
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [reactFlowInstance, setNodes]
    );

    // Load existing workflow
    React.useEffect(() => {
        if (id) {
            workflowsService.getWorkflow(id).then(wf => {
                setWorkflow(wf);
                setName(wf.name);
                if (wf.definition) {
                    // ...
                    // Restore flow from definition
                    const { nodes: flowNodes, edges: flowEdges, viewport } = wf.definition;
                    setNodes(flowNodes || []);
                    setEdges(flowEdges || []);
                    if (viewport && reactFlowInstance) {
                        reactFlowInstance.setViewport(viewport);
                    }
                }
            }).catch(err => {
                console.error('Failed to load workflow', err);
                // toast.error('Failed to load workflow');
            });
        }
    }, [id, reactFlowInstance]); // Add reactFlowInstance dependency for viewport restore

    // ... (onConnect, onDragOver, onDrop)

    const onSave = async () => {
        if (reactFlowInstance) {
            const flow = reactFlowInstance.toObject();
            const definition = flow;

            try {
                if (id) {
                    // Update
                    await workflowsService.updateWorkflow(id, {
                        name,
                        definition
                    });
                    // toast.success('Workflow saved');
                    alert('Workflow updated!');
                } else {
                    // Create
                    const newWorkflow = await workflowsService.createWorkflow({
                        name,
                        definition,
                        is_active: false
                    });
                    // toast.success('Workflow created');
                    alert('Workflow created!');
                    navigate(`/admin/workflow-builder/${newWorkflow.id}`); // This route needs to exist in App.tsx
                }
            } catch (error) {
                console.error('Failed to save', error);
                alert('Failed to save workflow');
            }
        }
    };

    // ...

    return (
        <div className="workflow-builder-layout">
            <div className="workflow-header">
                <div className="header-title">
                    {/* Allow editing name */}
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="workflow-name-input"
                    />
                    <p>Drag and drop actions to define the value stream.</p>
                </div>
                <div className="header-actions">
                    <button className="btn-secondary" onClick={onSave}><Save size={16} /> Save</button>
                    <button className="btn-primary"><Play size={16} /> Test Run</button>
                </div>
            </div>
            {/* ... rest of body ... */}

            <div className="workflow-body">
                <Sidebar />
                <div className="reactflow-wrapper" ref={reactFlowWrapper}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onInit={setReactFlowInstance}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        nodeTypes={nodeTypes}
                        fitView
                    >
                        <Controls />
                        <Background color="#aaa" gap={16} />
                    </ReactFlow>
                </div>
            </div>
            <style>{`
        .workflow-builder-layout {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 60px); /* Adjust based on header height */
          background: #fff;
        }
        .workflow-header {
          padding: 16px 24px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fff;
        }
        .header-title h1 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0;
        }
        .workflow-name-input {
            font-size: 1.25rem;
            font-weight: 600;
            color: #1e293b;
            margin: 0;
            border: 1px solid transparent;
            background: transparent;
            padding: 4px;
            border-radius: 4px;
            width: 300px;
        }
        .workflow-name-input:hover, .workflow-name-input:focus {
            border-color: #e2e8f0;
            background: white;
            outline: none;
        }
        .header-title p {
          font-size: 0.875rem;
          color: #64748b;
          margin: 4px 0 0 0;
        }
        .header-actions {
          display: flex;
          gap: 12px;
        }
        .btn-primary, .btn-secondary {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-primary {
          background: #3b82f6;
          color: white;
          border: none;
        }
        .btn-primary:hover { background: #2563eb; }
        .btn-secondary {
          background: white;
          color: #334155;
          border: 1px solid #e2e8f0;
        }
        .btn-secondary:hover { background: #f8fafc; }
        
        .workflow-body {
          flex: 1;
          display: flex;
          height: 100%;
          overflow: hidden;
        }
        .reactflow-wrapper {
          flex: 1;
          height: 100%;
          background: #f1f5f9;
        }
        /* Style Overrides for React Flow */
        .react-flow__handle {
          width: 8px;
          height: 8px;
          background: #94a3b8;
        }
        ${nodeStyles}
      `}</style>
        </div>
    );
};

export const WorkflowBuilder = () => {
    return (
        <ReactFlowProvider>
            <WorkflowBuilderContent />
        </ReactFlowProvider>
    );
};

export default WorkflowBuilder;
