import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  iconOnly?: boolean
  children?: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 active:scale-[0.98]',
  secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300 active:scale-[0.98] border border-neutral-200',
  danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 active:scale-[0.98]',
  ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 active:scale-[0.98]',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-base gap-2',
}

const iconOnlySizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 w-8 p-1.5',
  md: 'h-9 w-9 p-2',
  lg: 'h-10 w-10 p-2',
}

const LoadingSpinner = ({ size, className }: { size: ButtonSize; className?: string }) => {
  const spinnerSize = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size]

  return (
    <svg
      className={`animate-spin ${spinnerSize} ${className || ''}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      disabled = false,
      loading = false,
      icon,
      iconOnly = false,
      children,
      className = '',
      onClick,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    const baseClasses =
      'inline-flex items-center justify-center font-medium rounded-md transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400'

    const stateClasses = isDisabled
      ? 'opacity-50 cursor-not-allowed'
      : 'cursor-pointer hover:shadow-sm'

    const variantClass = variantClasses[variant]
    const sizeClass = iconOnly ? iconOnlySizeClasses[size] : sizeClasses[size]

    const combinedClasses = `${baseClasses} ${variantClass} ${sizeClass} ${stateClasses} ${className}`

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        onClick={onClick}
        className={combinedClasses}
        {...props}
      >
        {loading ? (
          <LoadingSpinner size={size} className={iconOnly ? '' : '-ml-0.5'} />
        ) : (
          icon && <span className="flex items-center justify-center">{icon}</span>
        )}
        {!iconOnly && children && <span>{children}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
