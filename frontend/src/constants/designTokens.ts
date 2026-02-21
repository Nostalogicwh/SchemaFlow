export const colors = {
  category: {
    browser: '#3B82F6',
    data: '#10B981',
    control: '#F59E0B',
    ai: '#8B5CF6',
    base: '#6B7280',
  },
  status: {
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
  neutral: {
    background: '#FAFAFA',
    surface: '#FFFFFF',
    border: '#E5E7EB',
    text: '#1F2937',
    textSecondary: '#6B7280',
  },
}

export const twColors = {
  category: {
    browser: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700', accent: 'bg-blue-500' },
    data: { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-700', accent: 'bg-emerald-500' },
    control: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-700', accent: 'bg-amber-500' },
    ai: { bg: 'bg-violet-50', border: 'border-violet-400', text: 'text-violet-700', accent: 'bg-violet-500' },
    base: { bg: 'bg-gray-50', border: 'border-gray-400', text: 'text-gray-700', accent: 'bg-gray-500' },
  },
  status: {
    success: { bg: 'bg-green-50', text: 'text-green-600', ring: 'ring-green-500' },
    error: { bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-500' },
    warning: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-500' },
    info: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-500' },
  },
}

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
}

export const twSpacing = {
  xs: 'p-1 gap-1',
  sm: 'p-2 gap-2',
  md: 'p-3 gap-3',
  lg: 'p-4 gap-4',
  xl: 'p-6 gap-6',
  '2xl': 'p-8 gap-8',
}

export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  full: '9999px',
}

export const twBorderRadius = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
}

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
}

export const twShadows = {
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
}

export const transitions = {
  fast: '150ms ease',
  normal: '200ms ease',
  slow: '300ms ease',
}

export const twTransitions = {
  fast: 'duration-150 ease-out',
  normal: 'duration-200 ease-out',
  slow: 'duration-300 ease-out',
}

export const nodeConfig = {
  minWidth: 280,
  maxWidth: 400,
  headerHeight: 44,
  portSize: 12,
  padding: {
    header: 'px-3 py-2',
    content: 'px-3 py-2',
  },
}

export const categoryGradients: Record<string, string> = {
  browser: 'from-blue-500 to-blue-600',
  data: 'from-emerald-500 to-emerald-600',
  control: 'from-amber-500 to-amber-600',
  ai: 'from-violet-500 to-violet-600',
  base: 'from-gray-500 to-gray-600',
}

export const statusRing: Record<string, string> = {
  idle: '',
  running: 'ring-2 ring-blue-400 ring-offset-1 animate-pulse',
  completed: 'ring-2 ring-green-500 ring-offset-1',
  failed: 'ring-2 ring-red-500 ring-offset-1',
}
