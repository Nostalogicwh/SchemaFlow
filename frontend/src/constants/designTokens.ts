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

export const colorSystem = {
  primary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },
  neutral: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
  semantic: {
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
}

export const twColorSystem = {
  primary: {
    50: 'bg-blue-50',
    100: 'bg-blue-100',
    200: 'bg-blue-200',
    300: 'bg-blue-300',
    400: 'bg-blue-400',
    500: 'bg-blue-500',
    600: 'bg-blue-600',
    700: 'bg-blue-700',
    800: 'bg-blue-800',
    900: 'bg-blue-900',
  },
  neutral: {
    50: 'bg-neutral-50',
    100: 'bg-neutral-100',
    200: 'bg-neutral-200',
    300: 'bg-neutral-300',
    400: 'bg-neutral-400',
    500: 'bg-neutral-500',
    600: 'bg-neutral-600',
    700: 'bg-neutral-700',
    800: 'bg-neutral-800',
    900: 'bg-neutral-900',
  },
  text: {
    primary: {
      50: 'text-blue-50',
      100: 'text-blue-100',
      500: 'text-blue-500',
      600: 'text-blue-600',
      700: 'text-blue-700',
      900: 'text-blue-900',
    },
    neutral: {
      400: 'text-neutral-400',
      500: 'text-neutral-500',
      600: 'text-neutral-600',
      700: 'text-neutral-700',
      800: 'text-neutral-800',
      900: 'text-neutral-900',
    },
    semantic: {
      success: 'text-green-600',
      error: 'text-red-600',
      warning: 'text-amber-600',
      info: 'text-blue-600',
    },
  },
}

export const semanticColors = {
  text: {
    primary: '#171717',
    secondary: '#525252',
    tertiary: '#A3A3A3',
    disabled: '#D4D4D4',
    inverted: '#FFFFFF',
  },
  bg: {
    page: '#FAFAFA',
    surface: '#FFFFFF',
    elevated: '#FFFFFF',
    sunken: '#F5F5F5',
  },
  border: {
    default: '#E5E5E5',
    hover: '#D4D4D4',
    focus: '#3B82F6',
    error: '#EF4444',
  },
  button: {
    primary: { bg: '#3B82F6', text: '#FFFFFF', hover: '#2563EB' },
    secondary: { bg: '#F5F5F5', text: '#171717', hover: '#E5E5E5' },
    danger: { bg: '#EF4444', text: '#FFFFFF', hover: '#DC2626' },
    ghost: { bg: 'transparent', text: '#525252', hover: '#F5F5F5' },
  },
}

export const twSemanticColors = {
  text: {
    primary: 'text-neutral-900',
    secondary: 'text-neutral-600',
    tertiary: 'text-neutral-400',
    disabled: 'text-neutral-300',
    inverted: 'text-white',
  },
  bg: {
    page: 'bg-neutral-50',
    surface: 'bg-white',
    elevated: 'bg-white',
    sunken: 'bg-neutral-100',
  },
  border: {
    default: 'border-neutral-200',
    hover: 'border-neutral-300',
    focus: 'border-blue-500',
    error: 'border-red-500',
  },
  button: {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100',
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

export const spacingSystem = {
  panel: '24px',
  section: '20px',
  card: '16px',
  inlineGap: '8px',
  sectionGap: '16px',
  stackGap: '12px',
  itemGap: '8px',
  microGap: '4px',
}

export const twSpacingSystem = {
  panel: 'p-6 gap-6',
  section: 'p-5 gap-5',
  card: 'p-4 gap-4',
  inlineGap: 'gap-2',
  sectionGap: 'gap-4',
  stackGap: 'gap-3',
  itemGap: 'gap-2',
  microGap: 'gap-1',
}

export const typography = {
  h1: {
    fontSize: '36px',
    lineHeight: '44px',
    fontWeight: '700',
    letterSpacing: '-0.02em',
  },
  h2: {
    fontSize: '28px',
    lineHeight: '36px',
    fontWeight: '600',
    letterSpacing: '-0.01em',
  },
  h3: {
    fontSize: '20px',
    lineHeight: '28px',
    fontWeight: '600',
    letterSpacing: '-0.01em',
  },
  body: {
    fontSize: '14px',
    lineHeight: '22px',
    fontWeight: '400',
  },
  caption: {
    fontSize: '12px',
    lineHeight: '18px',
    fontWeight: '400',
  },
  label: {
    fontSize: '12px',
    lineHeight: '18px',
    fontWeight: '500',
  },
  code: {
    fontSize: '13px',
    lineHeight: '20px',
    fontWeight: '400',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
}

export const twTypography = {
  h1: 'text-4xl font-bold leading-11 tracking-tight',
  h2: 'text-2xl font-semibold leading-9 tracking-tight',
  h3: 'text-xl font-semibold leading-7 tracking-tight',
  body: 'text-sm font-normal leading-relaxed',
  caption: 'text-xs font-normal leading-5',
  label: 'text-xs font-medium leading-5',
  code: 'text-[13px] font-mono leading-5',
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

export const transitionSystem = {
  fast: { duration: '150ms', easing: 'ease-out' },
  normal: { duration: '200ms', easing: 'ease-out' },
  slow: { duration: '300ms', easing: 'ease-out' },
}

export const twTransitions = {
  fast: 'transition-all duration-150 ease-out',
  normal: 'transition-all duration-200 ease-out',
  slow: 'transition-all duration-300 ease-out',
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
