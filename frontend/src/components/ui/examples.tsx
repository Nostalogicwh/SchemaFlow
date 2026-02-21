/**
 * UI组件使用示例
 * 
 * 本文件展示了 Modal、Badge、Tag 三个组件的使用方式
 * 这些示例可以直接复制到项目中使用
 */

// ============================================
// Modal 组件使用示例
// ============================================

import { useState } from 'react'
import { Modal, Badge, Tag } from './'

// 示例1: 基础弹窗
function BasicModalExample() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        打开弹窗
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="确认删除"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              取消
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600"
            >
              确认删除
            </button>
          </div>
        }
      >
        <p className="text-gray-600">
          确定要删除这个工作流吗？此操作不可撤销。
        </p>
      </Modal>
    </>
  )
}

// 示例2: 不同尺寸的弹窗
function SizeVariantsExample() {
  const [size, setSize] = useState<'sm' | 'md' | 'lg' | 'fullscreen'>('md')
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <div className="flex gap-2">
        {(['sm', 'md', 'lg', 'fullscreen'] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSize(s)
              setIsOpen(true)
            }}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
          >
            {s}
          </button>
        ))}
      </div>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`${size.toUpperCase()} 尺寸弹窗`}
        size={size}
        footer={
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            关闭
          </button>
        }
      >
        <div className="space-y-2">
          <p>这是一个 {size} 尺寸的弹窗示例。</p>
          {size === 'fullscreen' && (
            <p className="text-gray-500">
              全屏模式下弹窗会占据整个视口，适合展示复杂内容。
            </p>
          )}
        </div>
      </Modal>
    </>
  )
}

// 示例3: 表单弹窗（焦点捕获示例）
function FormModalExample() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
      >
        新建节点
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="添加新节点"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              取消
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              创建
            </button>
          </div>
        }
      >
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              节点名称
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              placeholder="输入节点名称"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              节点类型
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500">
              <option value="browser">浏览器操作</option>
              <option value="data">数据处理</option>
              <option value="control">控制流</option>
              <option value="ai">AI操作</option>
            </select>
          </div>
        </form>
      </Modal>
    </>
  )
}

// ============================================
// Badge 组件使用示例
// ============================================

// 示例4: 所有状态展示
function BadgeVariantsExample() {
  const statuses: Array<{ status: 'running' | 'completed' | 'failed' | 'pending'; desc: string }> = [
    { status: 'running', desc: '节点正在执行中...' },
    { status: 'completed', desc: '节点执行成功完成' },
    { status: 'failed', desc: '节点执行失败' },
    { status: 'pending', desc: '节点等待执行' },
  ]

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-700">全部状态</h3>
      <div className="flex flex-wrap gap-3">
        {statuses.map(({ status, desc }) => (
          <div key={status} className="flex items-center gap-2">
            <Badge status={status} size="md" />
            <span className="text-sm text-gray-500">{desc}</span>
          </div>
        ))}
      </div>

      <h3 className="font-medium text-gray-700">紧凑尺寸</h3>
      <div className="flex flex-wrap gap-2">
        {statuses.map(({ status }) => (
          <Badge key={status} status={status} size="sm" />
        ))}
      </div>
    </div>
  )
}

// 示例5: 在列表中使用
function BadgeInListExample() {
  const nodes = [
    { id: 1, name: '打开网页', status: 'completed' as const },
    { id: 2, name: '等待元素', status: 'running' as const },
    { id: 3, name: '点击按钮', status: 'pending' as const },
    { id: 4, name: '提取数据', status: 'failed' as const },
  ]

  return (
    <div className="border rounded-lg divide-y">
      {nodes.map((node) => (
        <div
          key={node.id}
          className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
        >
          <span className="font-medium">{node.name}</span>
          <Badge status={node.status} size="sm" />
        </div>
      ))}
    </div>
  )
}

// ============================================
// Tag 组件使用示例
// ============================================

// 示例6: 所有分类展示
function TagVariantsExample() {
  const categories: Array<{
    category: 'browser' | 'data' | 'control' | 'ai' | 'base'
    name: string
    desc: string
  }> = [
    { category: 'browser', name: '浏览器', desc: '网页操作相关' },
    { category: 'data', name: '数据', desc: '数据处理相关' },
    { category: 'control', name: '控制', desc: '流程控制相关' },
    { category: 'ai', name: 'AI', desc: 'AI功能相关' },
    { category: 'base', name: '基础', desc: '基础节点' },
  ]

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-700">全部分类</h3>
      <div className="flex flex-wrap gap-3">
        {categories.map(({ category, name }) => (
          <Tag key={category} category={category} size="md">
            {name}
          </Tag>
        ))}
      </div>

      <h3 className="font-medium text-gray-700">紧凑尺寸</h3>
      <div className="flex flex-wrap gap-2">
        {categories.map(({ category, name }) => (
          <Tag key={category} category={category} size="sm">
            {name}
          </Tag>
        ))}
      </div>
    </div>
  )
}

// 示例7: 节点卡片中使用
function TagInNodeCardExample() {
  const nodes = [
    { id: 1, name: 'Open Browser', category: 'browser' as const },
    { id: 2, name: 'Click Element', category: 'browser' as const },
    { id: 3, name: 'Extract Data', category: 'data' as const },
    { id: 4, name: 'Condition', category: 'control' as const },
    { id: 5, name: 'GPT Prompt', category: 'ai' as const },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {nodes.map((node) => (
        <div
          key={node.id}
          className="border rounded-lg p-3 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-2">
            <Tag category={node.category} size="sm">
              {node.category}
            </Tag>
          </div>
          <span className="font-medium text-gray-900">{node.name}</span>
        </div>
      ))}
    </div>
  )
}

// ============================================
// 综合示例：结合使用
// ============================================

// 示例8: 执行面板中的综合使用
function ExecutionPanelExample() {
  const [showModal, setShowModal] = useState(false)
  const [selectedNode, setSelectedNode] = useState<{
    name: string
    category: 'browser' | 'data' | 'control' | 'ai'
    status: 'running' | 'completed' | 'failed' | 'pending'
  } | null>(null)

  const executions = [
    { id: 1, name: 'Open Browser', category: 'browser' as const, status: 'completed' as const },
    { id: 2, name: 'Wait for Element', category: 'browser' as const, status: 'running' as const },
    { id: 3, name: 'Process Data', category: 'data' as const, status: 'pending' as const },
  ]

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-700">节点执行状态</h3>
      <div className="border rounded-lg divide-y">
        {executions.map((node) => (
          <div
            key={node.id}
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer"
            onClick={() => {
              setSelectedNode(node)
              setShowModal(true)
            }}
          >
            <div className="flex items-center gap-3">
              <Tag category={node.category} size="sm">
                {node.category}
              </Tag>
              <span className="font-medium">{node.name}</span>
            </div>
            <Badge status={node.status} size="sm" />
          </div>
        ))}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={selectedNode?.name || '节点详情'}
        size="md"
      >
        {selectedNode && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="text-sm text-gray-500">分类</label>
                <div className="mt-1">
                  <Tag category={selectedNode.category} size="md">
                    {selectedNode.category}
                  </Tag>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">状态</label>
                <div className="mt-1">
                  <Badge status={selectedNode.status} size="md" />
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-500">执行日志</label>
              <div className="mt-1 p-3 bg-gray-50 rounded text-sm font-mono">
                [2024-01-20 10:30:15] 节点开始执行
                <br />
                [2024-01-20 10:30:16] 正在处理...
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ============================================
// 导出所有示例
// ============================================

export {
  BasicModalExample,
  SizeVariantsExample,
  FormModalExample,
  BadgeVariantsExample,
  BadgeInListExample,
  TagVariantsExample,
  TagInNodeCardExample,
  ExecutionPanelExample,
}

// 默认展示所有示例
export default function AllExamples() {
  return (
    <div className="p-8 space-y-12 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">UI 组件示例</h1>

      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Modal 弹窗组件</h2>
        <div className="space-y-4">
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium text-gray-700 mb-3">基础弹窗</h3>
            <BasicModalExample />
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium text-gray-700 mb-3">尺寸变体</h3>
            <SizeVariantsExample />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Badge 状态标识</h2>
        <div className="space-y-4">
          <div className="p-4 border rounded-lg">
            <BadgeVariantsExample />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Tag 分类标签</h2>
        <div className="space-y-4">
          <div className="p-4 border rounded-lg">
            <TagVariantsExample />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">综合示例</h2>
        <div className="p-4 border rounded-lg">
          <ExecutionPanelExample />
        </div>
      </section>
    </div>
  )
}
