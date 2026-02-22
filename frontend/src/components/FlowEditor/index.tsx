import { useCallback, useEffect, useState } from 'react'
import { toast } from '@/stores/uiStore'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type OnConnect,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { nodeTypes, nodeCategoryMap } from './nodes'
import { NodePanel } from './panels/NodePanel'
import { Toolbar } from './panels/Toolbar'
import { useExecutionStore } from '@/stores/executionStore'
import type { ActionMetadata, Workflow, WorkflowNode, WorkflowEdge, NodeStatus } from '@/types/workflow'
import { actionApi } from '@/api'

type FlowNodeData = {
  label: string
  category: string
  config: Record<string, unknown>
  status: NodeStatus
  [key: string]: unknown
}

type FlowNode = Node<FlowNodeData>

interface FlowEditorProps {
  workflow: Workflow | null
  nodeStatuses?: Record<string, NodeStatus>
  onSave?: (workflow: Workflow) => void
}

function workflowToFlow(workflow: Workflow): { nodes: FlowNode[]; edges: Edge[] } {
  const nodes: FlowNode[] = workflow.nodes.map((node, index) => ({
    id: node.id,
    type: node.type,
    position: node.position ?? { x: 100 + index * 200, y: 100 + (index % 2) * 100 },
    data: {
      label: node.label || node.type,
      category: nodeCategoryMap[node.type] || 'base',
      config: node.config,
      status: 'idle' as NodeStatus,
    },
  }))

  const edges: Edge[] = workflow.edges.map((edge, index) => ({
    id: `e${index}`,
    source: edge.source,
    target: edge.target,
    animated: false,
  }))

  return { nodes, edges }
}

function flowToWorkflow(
  nodes: FlowNode[],
  edges: Edge[],
  baseWorkflow: Workflow
): Workflow {
  const workflowNodes: WorkflowNode[] = nodes.map((node) => ({
    id: node.id,
    type: node.type!,
    label: node.data.label,
    config: node.data.config || {},
    position: { x: node.position.x, y: node.position.y },
  }))

  const workflowEdges: WorkflowEdge[] = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }))

  return {
    ...baseWorkflow,
    nodes: workflowNodes,
    edges: workflowEdges,
    updated_at: new Date().toISOString(),
  }
}

export function FlowEditor(props: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner {...props} />
    </ReactFlowProvider>
  )
}

function FlowEditorInner({ workflow, nodeStatuses: externalNodeStatuses, onSave }: FlowEditorProps) {
  const [nodes, setNodes, onNodesState] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesState] = useEdgesState<Edge>([])
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null)
  const [actions, setActions] = useState<ActionMetadata[]>([])
  const [showPanel] = useState(true)
  const [showMiniMap] = useState(true)
  const { screenToFlowPosition } = useReactFlow()

  const storeNodeStatuses = useExecutionStore((state) => state.executionState.nodeStatuses)
  const nodeStatuses = externalNodeStatuses || storeNodeStatuses

  const onNodesChange = onNodesState
  const onEdgesChange = onEdgesState

  useEffect(() => {
    actionApi.list().then(setActions).catch(console.error)
  }, [])

  useEffect(() => {
    if (workflow) {
      const { nodes: flowNodes, edges: flowEdges } = workflowToFlow(workflow)
      setNodes(flowNodes)
      setEdges(flowEdges)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow?.id])

  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          status: nodeStatuses[node.id] || 'idle',
        },
      }))
    )
  }, [nodeStatuses, setNodes])

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds))
    },
    [setEdges]
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: FlowNode) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const handleUpdateNode = useCallback(
    (nodeId: string, config: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, config } }
            : node
        )
      )
      setSelectedNode((prev) =>
        prev?.id === nodeId
          ? { ...prev, data: { ...prev.data, config } }
          : prev
      )
    },
    [setNodes]
  )

  const handleUpdateNodeLabel = useCallback(
    (nodeId: string, label: string) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, label } }
            : node
        )
      )
      setSelectedNode((prev) =>
        prev?.id === nodeId
          ? { ...prev, data: { ...prev.data, label } }
          : prev
      )
    },
    [setNodes]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const data = event.dataTransfer.getData('application/reactflow')
      if (!data) return

      const action: ActionMetadata = JSON.parse(data)

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const newNode: FlowNode = {
        id: `node_${action.name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: action.name,
        position,
        data: {
          label: action.label,
          category: action.category,
          config: {},
          status: 'idle' as NodeStatus,
        },
      }

      setNodes((nds) => [...nds, newNode])
    },
    [setNodes, screenToFlowPosition]
  )

  const handleAIGenerate = useCallback(
    (
      aiNodes: { id: string; type: string; label?: string; config: Record<string, unknown> }[],
      aiEdges: { source: string; target: string }[]
    ) => {
      const startY = 100
      const gapY = 120
      const newNodes: FlowNode[] = aiNodes.map((n, i) => ({
        id: n.id,
        type: n.type,
        position: { x: 300, y: startY + i * gapY },
        data: {
          label: n.label || n.type,
          category: nodeCategoryMap[n.type] || 'base',
          config: n.config || {},
          status: 'idle' as NodeStatus,
        },
      }))

      const newEdges: Edge[] = aiEdges.map((e, i) => ({
        id: `ai_e${Date.now()}_${i}`,
        source: e.source,
        target: e.target,
      }))

      // 清除原工作流，添加新节点
      setNodes(newNodes)
      setEdges(newEdges)
    },
    [setNodes, setEdges]
  )

  const handleSave = useCallback(() => {
    if (!workflow || !onSave) return
    const updatedWorkflow = flowToWorkflow(nodes, edges, workflow)
    onSave(updatedWorkflow)
    toast.success('工作流已保存')
  }, [workflow, nodes, edges, onSave])

  return (
    <div className="flex h-full relative">
      <div className="border-r border-gray-200 bg-white shrink-0 w-48 shadow-sm">
        <Toolbar actions={actions} hasNodes={nodes.length > 0} onAIGenerate={handleAIGenerate} />
      </div>

      <div className="flex-1 h-full min-w-0" style={{ minHeight: '400px' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls showInteractive={false} />
          {showMiniMap && <MiniMap />}
        </ReactFlow>
      </div>

      <div
        className={`border-l border-gray-200 bg-white overflow-y-auto shrink-0 transition-all duration-300 shadow-sm ${
          showPanel ? 'w-80' : 'w-0 overflow-hidden'
        }`}
      >
        {showPanel && (
          <>
            <div className="p-2 border-b flex justify-between items-center">
              <span className="font-medium text-sm">属性</span>
              <div className="flex items-center gap-2">
                {onSave && (
                  <button
                    onClick={handleSave}
                    className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                  >
                    保存
                  </button>
                )}
              </div>
            </div>
            <NodePanel
              selectedNode={selectedNode}
              actionMetadata={actions}
              onUpdateNode={handleUpdateNode}
              onUpdateNodeLabel={handleUpdateNodeLabel}
            />
          </>
        )}
      </div>
    </div>
  )
}
