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
    /* Root wrapper — strictly bounded to viewport width, no horizontal overflow */
    <div
      style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden', position: 'relative' }}
      className="min-h-screen bg-zinc-50 text-zinc-900"
    >
      <CallManager />

      {/* Push Notification Banner */}
      {showNotificationPrompt && (
        <div className="w-full bg-zinc-900 text-white sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2 px-3 py-2 w-full">
            <BellRing className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[11px] leading-snug flex-1 min-w-0 truncate">
              <b>เปิดการแจ้งเตือน</b> เพื่อไม่พลาดข้อความและสายโทร
            </span>
            <button
              onClick={handleEnableNotifications}
              className="shrink-0 bg-white text-zinc-900 px-2.5 py-1 rounded-full font-bold text-[11px] hover:bg-zinc-100 active:scale-95 transition-all"
            >
              เปิด
            </button>
            <button
              onClick={handleDismissPrompt}
              className="shrink-0 p-1 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header — Mobile only */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200 w-full">
        <div className="flex items-center justify-between px-4 py-2 w-full">
          <button
            className="flex items-center gap-2"
            onClick={() => navigate('/')}
          >
            <img src={logoImg} alt="Commu Logo" className="h-8 w-auto object-contain" />
            <span className="font-bold text-zinc-900 text-base tracking-tight">COMMU</span>
          </button>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-2 text-zinc-600 hover:text-zinc-900 rounded-full hover:bg-zinc-100 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-zinc-900 rounded-full" />
              )}
            </button>
            <button onClick={() => navigate('/profile')}>
              <Avatar
                src={profile?.photoURL}
                name={profile?.displayName || 'User'}
                size="sm"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Page body: sidebar (desktop) + content */}
      <div className="flex w-full" style={{ minHeight: 'calc(100vh - 49px)' }}>
        {/* Sidebar — Desktop */}
        <aside className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0 border-r border-zinc-200 bg-white/90 backdrop-blur-xl p-5">
          <button
            className="flex items-center gap-3 mb-8 cursor-pointer group text-left"
            onClick={() => navigate('/')}
          >
            <div className="w-10 h-10 flex items-center justify-center transition-transform group-hover:scale-105">
              <img src={logoImg} alt="Commu Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-zinc-900 tracking-tight">COMMU</h1>
              <p className="text-xs text-zinc-400 font-medium">Social &amp; Communication</p>
            </div>
          </button>

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
                <Icon className="w-5 h-5 shrink-0" />
                <span className="font-medium">{label}</span>
                {to === '/notifications' && unreadCount > 0 && (
                  <span className="ml-auto bg-zinc-900 text-white text-xs px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="pt-5 border-t border-zinc-200">
            <button
              className="flex items-center gap-3 px-2 mb-4 w-full hover:opacity-90 transition-opacity text-left"
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
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span className="font-medium">ออกจากระบบ</span>
            </button>
          </div>
        </aside>

        {/* Main content — takes remaining width, strictly bounded */}
        <main
          className="flex-1 min-w-0 pb-20 lg:pb-0"
          style={{ overflowX: 'hidden', maxWidth: '100%' }}
        >
          <div className="w-full max-w-2xl mx-auto px-4 py-5 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom nav — Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-zinc-200">
        <div className="flex items-center justify-around px-1 py-1.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-0',
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
