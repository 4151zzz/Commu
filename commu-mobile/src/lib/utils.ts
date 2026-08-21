import { formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'

export function formatTimeAgo(date: Date): string {
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: th,
  })
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Generate initials avatar color based on name
 */
export function getAvatarColor(name: string): string {
  const colors = [
    '#7c3aed', '#6d28d9', '#4f46e5', '#0284c7', '#0891b2',
    '#059669', '#d97706', '#dc2626', '#db2777', '#9333ea',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}
