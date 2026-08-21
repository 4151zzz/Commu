import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home,
  MessageCircle,
  Users,
  Bell,
  User,
  LogOut,
  BellRing,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar } from '@/components/ui/Avatar'
import { logoutUser } from '@/services/auth.service'
import { useEffect, useState, useRef } from 'react'
import { subscribeToNotifications, getUnreadCount } from '@/services/notifications.service'
import {
  requestNotificationPermission,
  showLocalNotification,
  registerServiceWorker,
} from '@/services/push.service'
import type { AppNotification } from '@/types'
import { CallManager } from '@/components/call/CallManager'
import logoImg from '@/assets/logo.png'

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
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false)
  const previousNotifCountRef = useRef<number | null>(null)

  // Initialize service worker & check permission
  useEffect(() => {
    registerServiceWorker()
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const dismissed = localStorage.getItem('commu_dismiss_notif_prompt')
        if (!dismissed) {
          setShowNotificationPrompt(true)
        }
      }
    }
  }, [])

  useEffect(() => {
    if (!user) return
    return subscribeToNotifications(user.uid, (newNotifs) => {
      // If new unread notification arrives and window is not focused, trigger desktop/mobile alert
      if (
        previousNotifCountRef.current !== null &&
        newNotifs.length > previousNotifCountRef.current &&
        document.hidden
      ) {
        const latest = newNotifs[0]
        if (latest && !latest.read) {
          showLocalNotification(
            latest.fromUser?.displayName
              ? `🔔 ${latest.fromUser.displayName}`
              : '🔔 การแจ้งเตือนใหม่จาก COMMU',
            {
              body: latest.message,
              data: { url: latest.type === 'message' ? '/chat' : '/notifications' },
            }
          )
        }
      }
      previousNotifCountRef.current = newNotifs.length
      setNotifications(newNotifs)
    })
  }, [user])

  const unreadCount = getUnreadCount(notifications)

  const handleLogout = async () => {
    await logoutUser()
    navigate('/login')
  }

  const handleEnableNotifications = async () => {
    if (!user) return
    const granted = await requestNotificationPermission(user.uid)
    if (granted) {
      setShowNotificationPrompt(false)
    }
  }

  const handleDismissPrompt = () => {
    setShowNotificationPrompt(false)
    localStorage.setItem('commu_dismiss_notif_prompt', 'true')
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-zinc-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-zinc-100/60 rounded-full blur-3xl" />
      </div>

      <CallManager />

      {/* Push Notification Permission Banner */}
      {showNotificationPrompt && (
        <div className="bg-zinc-900 text-white text-xs px-4 py-2.5 flex items-center justify-between gap-3 sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2 max-w-xl mx-auto flex-1">
            <BellRing className="w-4 h-4 text-amber-400 flex-shrink-0 animate-bounce" />
            <span className="leading-tight">
              <b>เปิดการแจ้งเตือน</b> เพื่อให้รู้ทันทีเมื่อมีข้อความหรือคนโทรเข้า แม้จะปิดหน้าเว็บอยู่
            </span>
            <button
              onClick={handleEnableNotifications}
              className="ml-auto bg-white text-zinc-900 px-3 py-1 rounded-full font-bold hover:bg-zinc-100 transition-all active:scale-95 flex-shrink-0"
            >
              เปิดรับแจ้งเตือน
            </button>
            <button
              onClick={handleDismissPrompt}
              className="p-1 hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header for Mobile */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-zinc-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <img src={logoImg} alt="Commu Logo" className="h-9 w-auto object-contain" />
          <span className="font-bold text-zinc-900 text-lg tracking-tight">COMMU</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/notifications')}
            className="relative p-2 text-zinc-600 hover:text-zinc-900 rounded-full hover:bg-zinc-100 transition-colors"
            title="แจ้งเตือน"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-zinc-900 rounded-full" />
            )}
          </button>
          <div onClick={() => navigate('/profile')} className="cursor-pointer">
            <Avatar
              src={profile?.photoURL}
              name={profile?.displayName || 'User'}
              size="sm"
            />
          </div>
        </div>
      </header>

      <div className="relative flex min-h-screen">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex flex-col w-72 border-r border-zinc-200 bg-white/90 backdrop-blur-xl p-6">
          <div
            className="flex items-center gap-3 mb-8 cursor-pointer group"
            onClick={() => navigate('/')}
          >
            <div className="w-12 h-12 rounded-2xl bg-zinc-950 p-1.5 flex items-center justify-center shadow-lg border border-zinc-800 transition-transform group-hover:scale-105">
              <img src={logoImg} alt="Commu Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-zinc-900 tracking-tight flex items-center gap-1">
                COMMU
              </h1>
              <p className="text-xs text-zinc-400 font-medium">Social &amp; Communication</p>
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
                      ? 'bg-zinc-900 text-white shadow-md'
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
            <div
              className="flex items-center gap-3 px-2 mb-4 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => navigate('/profile')}
            >
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
