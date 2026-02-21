import { useState } from 'react'
import type { NodeExecutionRecord } from '@/types/workflow'
import { Badge, type BadgeStatus } from '@/components/ui/Badge'
import { EmptyState } from '@/components/common'
import { twSemanticColors, twColors, twTransitions } from '@/constants/designTokens'

interface NodeRecordListProps {
  records: NodeExecutionRecord[]
}

export function NodeRecordList({ records }: NodeRecordListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (records.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState
          icon="🔧"
          title="暂无执行记录"
          description="执行工作流后将显示节点执行记录"
        />
      </div>
    )
  }

  const totalDuration = records.reduce(
    (sum, r) => sum + (r.duration_ms || 0),
    0
  )
  const maxDuration = Math.max(...records.map((r) => r.duration_ms || 0))

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, BadgeStatus> = {
      completed: 'completed',
      failed: 'failed',
      running: 'running',
      pending: 'pending',
      skipped: 'completed',
    }
    return <Badge status={statusMap[status] || 'pending'} size="sm" />
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={`px-4 py-2 border-b ${twSemanticColors.border.default} ${twSemanticColors.bg.sunken} flex items-center justify-between`}>
        <span className={`text-xs ${twSemanticColors.text.secondary}`}>
          共 {records.length} 个节点
        </span>
        <span className={`text-xs font-medium ${twColors.status.info.text}`}>
          总耗时: {formatDuration(totalDuration)}
        </span>
      </div>
      
      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-neutral-100">
          {records.map((record, index) => {
            const isExpanded = expandedId === record.node_id
            const barWidth = maxDuration > 0
              ? ((record.duration_ms || 0) / maxDuration) * 100
              : 0

            return (
              <div key={record.node_id} className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-px bg-neutral-200" />
                
                <div className="relative pl-8">
                  {/* Timeline dot */}
                  <div className={`
                    absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10
                    ${record.status === 'completed' || record.status === 'skipped' ? 'bg-green-500' :
                      record.status === 'failed' ? 'bg-red-500' :
                      record.status === 'running' ? 'bg-blue-500 animate-pulse' :
                      'bg-neutral-400'
                    }
                  `} />
                  
                  {/* Record Header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : record.node_id)}
                    className={`
                      w-full px-3 py-3 flex items-center gap-3 
                      ${twTransitions.normal}
                      hover:bg-neutral-50 text-left
                    `}
                  >
                    <span className={`w-5 text-xs ${twSemanticColors.text.tertiary}`}>
                      {index + 1}
                    </span>
                    {getStatusBadge(record.status)}
                    <span className={`text-sm flex-1 truncate ${twSemanticColors.text.primary}`}>
                      {record.node_label}
                    </span>
                    <span className={`text-xs ${twSemanticColors.text.secondary} w-16 text-right`}>
                      {record.duration_ms != null
                        ? formatDuration(record.duration_ms)
                        : '-'}
                    </span>
                    <svg 
                      className={`
                        w-4 h-4 ${twSemanticColors.text.tertiary}
                        ${twTransitions.normal}
                        ${isExpanded ? 'rotate-180' : ''}
                      `}
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Progress bar */}
                  <div className="px-3 pb-2">
                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className={`
                          h-full ${twTransitions.normal}
                          ${record.status === 'completed' || record.status === 'skipped'
                            ? twColors.status.success.bg
                            : record.status === 'failed'
                            ? twColors.status.error.bg
                            : twColors.status.info.bg
                          }
                        `}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className={`px-4 pb-4 text-xs ${twSemanticColors.bg.sunken} rounded-b-lg`}>
                      <div className={`flex gap-4 ${twSemanticColors.text.secondary} mb-2 pt-2`}>
                        <span>类型: {record.node_type}</span>
                        <span>状态: {record.status}</span>
                        {record.started_at && (
                          <span>
                            开始: {new Date(record.started_at).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      {record.error && (
                        <div className={`${twColors.status.error.text} py-1`}>
                          错误: {record.error}
                        </div>
                      )}
                      {record.result && (
                        <div className={`${twSemanticColors.text.primary} py-1`}>
                          <span className={twSemanticColors.text.secondary}>返回值: </span>
                          <pre className={`
                            mt-1 p-2 rounded overflow-x-auto
                            ${twSemanticColors.bg.sunken} border ${twSemanticColors.border.default}
                          `}>
                            {JSON.stringify(record.result, null, 2)}
                          </pre>
                        </div>
                      )}
                      {record.logs.length > 0 && (
                        <div className={`mt-2 border-t ${twSemanticColors.border.default} pt-2`}>
                          {record.logs.map((log, i) => (
                            <div
                              key={i}
                              className={`py-0.5 ${
                                log.level === 'error'
                                  ? twColors.status.error.text
                                  : log.level === 'warning'
                                  ? twColors.status.warning.text
                                  : twSemanticColors.text.secondary
                              }`}
                            >
                              {log.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.round((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

export default NodeRecordList