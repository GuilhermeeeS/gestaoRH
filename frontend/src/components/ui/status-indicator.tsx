import { RefreshCcw, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type IndicatorSize = 'sm' | 'md' | 'lg'

const sizeClassMap: Record<IndicatorSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
}

interface LoadingIndicatorProps {
  label?: string
  size?: IndicatorSize
  className?: string
  iconClassName?: string
  children?: ReactNode
}

export function LoadingIndicator({
  label = 'Atualizando',
  size = 'md',
  className,
  iconClassName,
  children,
}: LoadingIndicatorProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}>
      <RefreshCcw className={cn(sizeClassMap[size], 'animate-spin', iconClassName)} aria-hidden="true" />
      {children}
      <span className="sr-only">{label}</span>
    </span>
  )
}

interface ErrorIndicatorProps {
  message?: string
  size?: IndicatorSize
  className?: string
  iconClassName?: string
}

export function ErrorIndicator({ message, size = 'md', className, iconClassName }: ErrorIndicatorProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-red-600', className)}>
      <XCircle className={cn(sizeClassMap[size], 'text-red-500', iconClassName)} aria-hidden="true" />
      {message ? <span>{message}</span> : null}
      <span className="sr-only">Erro</span>
    </span>
  )
}
