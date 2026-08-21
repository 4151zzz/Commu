import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

export function Card({ children, className, hover, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl bg-white border border-zinc-200 shadow-sm',
        hover && 'hover:bg-zinc-50 hover:border-zinc-300 transition-all duration-200 cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  )
}
