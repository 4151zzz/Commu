import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home,
  MessageCircle,
  Users,
  Bell,
  User,
  LogOut,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar } from '@/components/ui/Avatar'
import { logoutUser } from '@/services/auth.service'
import { useEffect, useState } from 'react'
import { subscribeToNotifications, getUnreadCount } from '@/services/notifications.service'
import type { AppNotification } from '@/types'
import { CallManager } from '@/components/call/CallManager'

const navItems = [
  { to: '/', icon: Home, label: 'ฟีด' },
  { to: '/chat', icon: MessageCircle, label: 'แชท' },
  { to: '/friends', icon: Users, label: 'เพื่อน' },
  { to: '/notifications', icon: Bell, label: 'แจ้งเตือน' },
  { to: '/profile', icon: User, label: 'โปรไฟล์' },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  useEffect(() => {
    if (!user) return
    return subscribeToNotifications(user.uid, setNotifications)
  }, [user])

  const unreadCount = getUnreadCount(notifications)

  const handleLogout = async () => {
    await logoutUser()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-zinc-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-zinc-100/60 rounded-full blur-3xl" />
      </div>

      <CallManager />

      <div className="relative flex min-h-screen">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex flex-col w-72 border-r border-zinc-200 bg-white/90 backdrop-blur-xl p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900">
                Commu
              </h1>
              <p className="text-xs text-zinc-500">Social &amp; Chat</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                    isActive
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                  )
                }
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{label}</span>
                {to === '/notifications' && unreadCount > 0 && (
                  <span className="ml-auto bg-zinc-900 text-white text-xs px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="pt-6 border-t border-zinc-200">
            <div className="flex items-center gap-3 px-2 mb-4">
              <Avatar
                src={profile?.photoURL}
                name={profile?.displayName || 'User'}
                size="md"
                online={profile?.isOnline}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-zinc-900">{profile?.displayName}</p>
                <p className="text-xs text-zinc-500 truncate">@{profile?.username}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">ออกจากระบบ</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-h-screen pb-20 lg:pb-0">
          <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom nav - Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-zinc-200 px-2 py-2">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all',
                  isActive ? 'text-zinc-900' : 'text-zinc-400'
                )
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
              {to === '/notifications' && unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-zinc-900 rounded-full" />
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
