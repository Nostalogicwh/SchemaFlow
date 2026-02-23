/**
 * 节点属性面板 - 编辑选中节点的配置
 * v2: 使用A2组件优化 - FormField、Input、Select、Textarea、Badge、Tag
 */
import { useCallback, useState } from 'react'
import type { Node } from '@xyflow/react'
import type { ActionMetadata, JsonSchemaProperty } from '@/types/workflow'
import { EmptyState } from '@/components/common'
import { Input } from '@/components/ui/Input'
import { MousePointer2, Settings2, Bug } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { FormField } from '@/components/ui/FormField'
import { Tag } from '@/components/ui/Tag'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils'
import { DebugLocatorModal } from '@/components/FlowEditor/DebugLocatorModal'

interface NodePanelProps {
  selectedNode: Node | null
  actionMetadata: ActionMetadata[]
  onUpdateNode: (nodeId: string, config: Record<string, unknown>) => void
  onUpdateNodeLabel: (nodeId: string, label: string) => void
  wsConnection?: WebSocket | null
}

export function NodePanel({ selectedNode, actionMetadata, onUpdateNode, onUpdateNodeLabel, wsConnection }: NodePanelProps) {
  // 获取当前节点的元数据
  const metadata = actionMetadata.find(a => a.name === selectedNode?.type)

  // 获取节点数据
  const nodeData = selectedNode?.data as {
    label?: string
    category?: string
    status?: 'idle' | 'running' | 'completed' | 'failed'
    config?: Record<string, unknown>
  } | undefined

  // 调试弹窗状态
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false)

  // 更新配置
  const handleChange = useCallback(
    (key: string, value: unknown) => {
      if (!selectedNode) return
      const currentConfig = (selectedNode.data as { config?: Record<string, unknown> }).config || {}
      onUpdateNode(selectedNode.id, { ...currentConfig, [key]: value })
    },
    [selectedNode, onUpdateNode]
  )

  // 检查节点是否支持AI定位
  const supportsAiLocator = metadata?.name === 'wait_for_element' ||
    metadata?.name === 'browser_click' ||
    metadata?.name === 'browser_input'

  // 处理保存选择器
  const handleSaveSelector = useCallback((selector: string) => {
    if (!selectedNode) return
    const currentConfig = (selectedNode.data as { config?: Record<string, unknown> }).config || {}
    onUpdateNode(selectedNode.id, { ...currentConfig, selector })
  }, [selectedNode, onUpdateNode])

  // 打开调试弹窗
  const openDebugModal = useCallback(() => {
    setIsDebugModalOpen(true)
  }, [])

  if (!selectedNode) {
    return (
      <EmptyState
        icon={MousePointer2}
        title="未选中节点"
        description="点击画布中的节点查看和编辑属性"
        compact
      />
    )
  }

  if (!metadata) {
    return (
      <div className="p-4">
        <h3 className="font-bold text-lg mb-2">{selectedNode.type}</h3>
        <EmptyState
          icon={Settings2}
          title="无可配置参数"
          description="此节点类型没有可配置的参数"
          compact
        />
      </div>
    )
  }

  const properties = metadata.parameters.properties || {}
  const required = metadata.parameters.required || []
  const currentConfig = nodeData?.config || {}

  // 获取分类图标和标签
  const category = (nodeData?.category as 'browser' | 'data' | 'control' | 'ai' | 'base') || 'base'
  const nodeStatus = nodeData?.status || 'idle'

  return (
    <div className="p-4">
      {/* 节点标题区域 - 增加图标和状态 */}
      <div className="mb-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <Tag category={category} size="sm">
            {metadata.label}
          </Tag>
          {nodeStatus !== 'idle' && (
            <Badge 
              status={nodeStatus} 
              size="sm" 
            />
          )}
        </div>
        <p className="text-sm text-neutral-500">{metadata.description}</p>
      </div>

      {/* 节点名称编辑 */}
      <div className="mb-4">
        <FormField label="节点名称" helpText="自定义节点显示名称">
          <Input
            type="text"
            value={nodeData?.label || ''}
            onChange={(e) => onUpdateNodeLabel(selectedNode.id, e.target.value)}
            placeholder={metadata.label}
          />
        </FormField>
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

        {/* AI 定位配置区域 - 仅对支持的节点显示 */}
        {supportsAiLocator && (
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">AI 智能定位</h4>
              <Button
                onClick={openDebugModal}
                variant="secondary"
                size="sm"
                icon={<Bug className="w-4 h-4" />}
              >
                调试定位
              </Button>
            </div>

            {/* 已保存的选择器显示 */}
            <div className="mb-3">
              <FormField
                label="已保存的选择器"
                helpText="调试成功后自动保存，下次优先使用"
              >
                <Input
                  type="text"
                  value={(currentConfig.selector as string) ?? ''}
                  onChange={(e) => handleChange('selector', e.target.value || undefined)}
                  placeholder="未保存选择器，请使用调试功能生成"
                  readOnly={!currentConfig.selector}
                />
              </FormField>
            </div>

            {/* AI 后备开关 */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">
                当 CSS 选择器失效时启用 AI 定位
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={!!(currentConfig.enable_ai_fallback ?? true)}
                onClick={() => handleChange('enable_ai_fallback', !(currentConfig.enable_ai_fallback ?? true))}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  (currentConfig.enable_ai_fallback ?? true) ? 'bg-blue-500' : 'bg-gray-300'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    (currentConfig.enable_ai_fallback ?? true) ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 调试定位弹窗 */}
      {supportsAiLocator && (
        <DebugLocatorModal
          isOpen={isDebugModalOpen}
          onClose={() => setIsDebugModalOpen(false)}
          nodeId={selectedNode?.id || ''}
          nodeType={selectedNode?.type || ''}
          onSave={handleSaveSelector}
          wsConnection={wsConnection || null}
        />
      )}
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

  // 获取字段的帮助文字
  const getHelpText = (fieldName: string): string | undefined => {
    const helpTexts: Record<string, string> = {
      selector: '浏览器中右键元素 → 检查 → 右键高亮节点 → Copy → Copy selector',
      ai_target: '用自然语言描述目标元素，无需 CSS 选择器',
      url: '完整的网页地址，如 https://example.com',
      text: '要输入的文本内容',
      prompt: '输入给AI的提示词或指令',
      code: 'JavaScript代码片段',
      wait_time: '等待元素出现的时间（秒），超过此时间未找到元素会报错',
      timeout: '节点的最大执行时间（秒），超过此时间会强制结束',
      variable_name: '变量名称，用于存储数据',
    }
    return helpTexts[fieldName]
  }

  // 获取placeholder
  const getPlaceholder = (fieldName: string, fieldLabel: string): string => {
    const placeholders: Record<string, string> = {
      selector: '#login-btn 或 .submit-button',
      ai_target: '如：登录按钮、搜索框',
      url: 'https://',
      text: '输入文本内容',
      prompt: '请输入提示词...',
      code: '// 输入JavaScript代码',
      variable_name: 'myVariable',
    }
    return placeholders[fieldName] || `输入${fieldLabel}`
  }

  // 枚举类型 - 下拉选择
  if (property.enum) {
    const options = property.enum.map(opt => ({
      value: opt,
      label: opt,
    }))
    
    return (
      <FormField
        label={label}
        required={required}
        helpText={getHelpText(name)}
      >
        <Select
          options={options}
          placeholder="请选择"
          value={(value as string) ?? (defaultValue as string) ?? ''}
          onChange={(val) => onChange(val || undefined)}
        />
      </FormField>
    )
  }

  // 布尔类型 - 开关
  if (property.type === 'boolean') {
    const switchId = `switch-${name}`
    return (
      <div className="flex items-center justify-between">
        <label htmlFor={switchId} className="text-sm font-medium text-gray-700 cursor-pointer">{label}</label>
        <button
          id={switchId}
          type="button"
          role="switch"
          aria-checked={!!(value ?? defaultValue)}
          onClick={() => onChange(!(value ?? defaultValue))}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            (value ?? defaultValue) ? 'bg-blue-500' : 'bg-gray-300'
          )}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
              (value ?? defaultValue) ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>
    )
  }

  // 数字类型
  if (property.type === 'number' || property.type === 'integer') {
    const displayValue = value !== undefined && value !== null && value !== '' ? String(value) : ''
    return (
      <FormField
        label={label}
        required={required}
        helpText={getHelpText(name)}
      >
        <Input
          type="number"
          value={displayValue}
          onChange={(e) => {
            const val = e.target.value
            if (val === '') {
              onChange(0)
            } else {
              const num = Number(val)
              if (!isNaN(num)) {
                onChange(num)
              }
            }
          }}
          placeholder={getPlaceholder(name, label)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing && e.key === 'Enter') {
              e.preventDefault()
            }
          }}
        />
      </FormField>
    )
  }

  // 长文本类型 - Textarea
  if (name === 'prompt' || name === 'code' || property.type === 'textarea') {
    return (
      <FormField
        label={label}
        required={required}
        helpText={getHelpText(name)}
      >
        <Textarea
          value={(value as string) ?? (defaultValue as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder={getPlaceholder(name, label)}
          autoResize
          minRows={3}
          maxRows={8}
        />
      </FormField>
    )
  }

  // 默认字符串类型 - Input
  return (
    <FormField
      label={label}
      required={required}
      helpText={getHelpText(name)}
    >
      <Input
        type="text"
        value={(value as string) ?? (defaultValue as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={getPlaceholder(name, label)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing && e.key === 'Enter') {
            e.preventDefault()
          }
        }}
      />
    </FormField>
  )
}
