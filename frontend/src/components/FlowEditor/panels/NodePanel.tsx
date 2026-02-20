/**
 * 节点属性面板 - 编辑选中节点的配置
 */
import { useCallback } from 'react'
import type { Node } from '@xyflow/react'
import type { ActionMetadata, JsonSchemaProperty } from '@/types/workflow'

interface NodePanelProps {
  selectedNode: Node | null
  actionMetadata: ActionMetadata[]
  onUpdateNode: (nodeId: string, config: Record<string, unknown>) => void
}

export function NodePanel({ selectedNode, actionMetadata, onUpdateNode }: NodePanelProps) {
  // 获取当前节点的元数据
  const metadata = actionMetadata.find(a => a.name === selectedNode?.type)

  // 更新配置
  const handleChange = useCallback(
    (key: string, value: unknown) => {
      if (!selectedNode) return
      const currentConfig = (selectedNode.data as { config?: Record<string, unknown> }).config || {}
      onUpdateNode(selectedNode.id, { ...currentConfig, [key]: value })
    },
    [selectedNode, onUpdateNode]
  )

  if (!selectedNode) {
    return (
      <div className="p-4 text-gray-500 text-center">
        <p>选择一个节点查看属性</p>
      </div>
    )
  }

  if (!metadata) {
    return (
      <div className="p-4">
        <h3 className="font-bold text-lg mb-2">{selectedNode.type}</h3>
        <p className="text-gray-500">无可配置参数</p>
      </div>
    )
  }

  const properties = metadata.parameters.properties || {}
  const required = metadata.parameters.required || []
  const currentConfig = (selectedNode.data as { config?: Record<string, unknown> }).config || {}

  return (
    <div className="p-4">
      {/* 节点标题 */}
      <div className="mb-4">
        <h3 className="font-bold text-lg">{metadata.label}</h3>
        <p className="text-sm text-gray-500">{metadata.description}</p>
      </div>

      {/* 参数表单 */}
      <div className="space-y-4">
        {Object.entries(properties).map(([key, prop]) => (
          <FieldRenderer
            key={key}
            name={key}
            property={prop}
            value={currentConfig[key]}
            required={required.includes(key)}
            onChange={(value) => handleChange(key, value)}
          />
        ))}
      </div>
    </div>
  )
}

// 字段渲染器
interface FieldRendererProps {
  name: string
  property: JsonSchemaProperty
  value: unknown
  required: boolean
  onChange: (value: unknown) => void
}

function FieldRenderer({ name, property, value, required, onChange }: FieldRendererProps) {
  const label = property.description || name
  const defaultValue = property.default

  // 枚举类型 - 下拉选择
  if (property.enum) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <select
          value={(value as string) ?? (defaultValue as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">请选择</option>
          {property.enum.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    )
  }

  // 布尔类型 - 开关
  if (property.type === 'boolean') {
    return (
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <button
          type="button"
          onClick={() => onChange(!(value ?? defaultValue))}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${(value ?? defaultValue) ? 'bg-blue-500' : 'bg-gray-300'}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${(value ?? defaultValue) ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>
    )
  }

  // 数字类型
  if (property.type === 'number' || property.type === 'integer') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          type="number"
          value={(value as number) ?? (defaultValue as number) ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    )
  }

  // 默认字符串类型 - 文本输入
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {name === 'prompt' || name === 'code' ? (
        <textarea
          value={(value as string) ?? (defaultValue as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder={`输入${label}`}
        />
      ) : (
        <input
          type="text"
          value={(value as string) ?? (defaultValue as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={`输入${label}`}
        />
      )}
    </div>
  )
}
