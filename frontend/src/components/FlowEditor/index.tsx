/**
 * 可视化工作流编辑器
 */
import { useCallback, useEffect, useState } from 'react'
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
import type { ActionMetadata, Workflow, WorkflowNode, WorkflowEdge, NodeStatus } from '@/types/workflow'
import { actionApi } from '@/api'

// 节点数据类型
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

// 将后端工作流格式转换为 ReactFlow 格式
function workflowToFlow(workflow: Workflow): { nodes: FlowNode[]; edges: Edge[] } {
  const nodes: FlowNode[] = workflow.nodes.map((node, index) => ({
    id: node.id,
    type: node.type,
    position: node.position ?? { x: 100 + index * 200, y: 100 + (index % 2) * 100 },
    data: {
      label: node.type,
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

// 将 ReactFlow 格式转换为后端工作流格式
function flowToWorkflow(
  nodes: FlowNode[],
  edges: Edge[],
  baseWorkflow: Workflow
): Workflow {
  const workflowNodes: WorkflowNode[] = nodes.map((node) => ({
    id: node.id,
    type: node.type!,
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

function FlowEditorInner({ workflow, nodeStatuses = {}, onSave }: FlowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null)
  const [actions, setActions] = useState<ActionMetadata[]>([])
  const { screenToFlowPosition } = useReactFlow()

  // 加载节点元数据
  useEffect(() => {
    actionApi.list().then(setActions).catch(console.error)
  }, [])

  // 加载工作流
  useEffect(() => {
    if (workflow) {
      const { nodes: flowNodes, edges: flowEdges } = workflowToFlow(workflow)
      setNodes(flowNodes)
      setEdges(flowEdges)
    }
  }, [workflow, setNodes, setEdges])

  // 更新节点状态
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

  // 连线
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds))
    },
    [setEdges]
  )

  // 选中节点
  const onNodeClick = useCallback((_: React.MouseEvent, node: FlowNode) => {
    setSelectedNode(node)
  }, [])

  // 取消选中
  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  // 更新节点配置
  const handleUpdateNode = useCallback(
    (nodeId: string, config: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, config } }
            : node
        )
      )
      // 同步更新选中节点
      setSelectedNode((prev) =>
        prev?.id === nodeId
          ? { ...prev, data: { ...prev.data, config } }
          : prev
      )
    },
    [setNodes]
  )

  // 拖放添加节点
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

  // AI 编排：将生成的节点和连线添加到画布
  const handleAIGenerate = useCallback(
    (
      aiNodes: { id: string; type: string; label?: string; config: Record<string, unknown> }[],
      aiEdges: { source: string; target: string }[]
    ) => {
      // 将 AI 生成的节点转为 FlowNode，纵向自动布局
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

      setNodes((nds) => [...nds, ...newNodes])
      setEdges((eds) => [...eds, ...newEdges])
    },
    [setNodes, setEdges]
  )

  // 保存工作流
  const handleSave = useCallback(() => {
    if (!workflow || !onSave) return
    const updatedWorkflow = flowToWorkflow(nodes, edges, workflow)
    onSave(updatedWorkflow)
  }, [workflow, nodes, edges, onSave])

  return (
    <div className="flex h-full">
      {/* 左侧工具栏 */}
      <div className="w-48 border-r bg-white">
        <Toolbar actions={actions} onAIGenerate={handleAIGenerate} />
      </div>

      {/* 中间画布 */}
      <div className="flex-1 h-full" style={{ minHeight: '400px' }}>
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
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {/* 右侧属性面板 */}
      <div className="w-72 border-l bg-white overflow-y-auto">
        <div className="p-2 border-b flex justify-between items-center">
          <span className="font-medium text-sm">属性</span>
          {onSave && (
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
            >
              保存
            </button>
          )}
        </div>
        <NodePanel
          selectedNode={selectedNode}
          actionMetadata={actions}
          onUpdateNode={handleUpdateNode}
        />
      </div>
    </div>
  )
}
