import { useEffect, useState } from 'react'
import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  Share2,
  Repeat2,
  Phone,
  CheckCheck,
  Trash2,
  BellRing,
  CheckCircle2,
  Smartphone,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageLoader } from '@/components/ui/Spinner'
import { formatTimeAgo, cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  cleanupOldNotifications,
} from '@/services/notifications.service'
import {
  requestNotificationPermission,
  getNotificationPermissionStatus,
} from '@/services/push.service'
import type { AppNotification } from '@/types'
import { useNavigate } from 'react-router-dom'

const iconMap = {
  friend_request: UserPlus,
  friend_accepted: UserPlus,
  like: Heart,
  comment: MessageCircle,
  message: MessageCircle,
  share: Share2,
  repost: Repeat2,
  call: Phone,
}

const colorMap = {
  friend_request: 'text-zinc-700 bg-zinc-100',
  friend_accepted: 'text-zinc-700 bg-zinc-100',
  like: 'text-zinc-700 bg-zinc-100',
  comment: 'text-zinc-700 bg-zinc-100',
  message: 'text-zinc-700 bg-zinc-100',
  share: 'text-zinc-700 bg-zinc-100',
  repost: 'text-zinc-700 bg-zinc-100',
  call: 'text-zinc-700 bg-zinc-100',
}

export function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [pushStatus, setPushStatus] = useState<NotificationPermission | 'unsupported'>('default')
  const [enablingPush, setEnablingPush] = useState(false)

  useEffect(() => {
    setPushStatus(getNotificationPermissionStatus())
  }, [])

  useEffect(() => {
    if (!user) return
    
    // Auto-cleanup old notifications (older than 7 days)
    cleanupOldNotifications(user.uid).catch(console.error)

    const unsub = subscribeToNotifications(user.uid, (data) => {
      setNotifications(data)
      setLoading(false)
    })
    return unsub
  }, [user])

  const handleEnablePush = async () => {
    if (!user) return
    setEnablingPush(true)
    try {
      const granted = await requestNotificationPermission(user.uid)
      if (granted) {
        setPushStatus('granted')
      } else {
        setPushStatus(getNotificationPermissionStatus())
      }
    } finally {
      setEnablingPush(false)
    }
  }

  const handleRead = async (id: string) => {
    await markNotificationRead(id)
  }

  const handleReadAll = async () => {
    if (!user) return
    await markAllNotificationsRead(user.uid)
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">แจ้งเตือน</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {unreadCount > 0 ? `${unreadCount} รายการใหม่` : 'ไม่มีแจ้งเตือนใหม่'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleReadAll}>
            <CheckCheck className="w-4 h-4" />
            อ่านทั้งหมด
          </Button>
        )}
      </div>

      {/* Push Notification Setup Card for Mobile & PC */}
      <Card className="p-4 mb-6 bg-gradient-to-br from-zinc-900 to-zinc-950 text-white border-zinc-800 shadow-xl">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
            {pushStatus === 'granted' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <BellRing className="w-5 h-5 text-amber-400 animate-pulse" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">การแจ้งเตือนพุช (เมื่อปิดหน้าจอ/ปิดเว็บ)</h3>
            <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
              {pushStatus === 'granted'
                ? 'เปิดการแจ้งเตือนบนอุปกรณ์นี้เรียบร้อยแล้ว คุณจะได้รับข้อความและสายโทรเข้าทันที'
                : 'เปิดรับการแจ้งเตือนบนโทรศัพท์หรือคอมพิวเตอร์ของคุณ เพื่อไม่พลาดทุกข้อความสำคัญ'}
            </p>

            {pushStatus !== 'granted' && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleEnablePush}
                  loading={enablingPush}
                  className="bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-xs shadow-md active:scale-95"
                >
                  <Bell className="w-3.5 h-3.5 mr-1" />
                  เปิดการแจ้งเตือนบนเครื่องนี้
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Note for iOS users */}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-[11px] text-zinc-400">
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span><b>ผู้ใช้ iPhone (iOS):</b> กดปุ่ม Share ที่ Safari แล้วเลือก <i>"เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)"</i> เพื่อเปิดรับการแจ้งเตือน</span>
        </div>
      </Card>

      {loading ? (
        <PageLoader />
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
          <p className="text-zinc-500">ยังไม่มีการแจ้งเตือน</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const Icon = iconMap[notif.type] || Bell
            return (
              <Card
                key={notif.id}
                className={cn(
                  'p-4 flex items-start gap-3 cursor-pointer transition-all hover:bg-zinc-50',
                  !notif.read && 'bg-zinc-50 border-zinc-300'
                )}
                onClick={async () => {
                  if (!notif.read) {
                    await handleRead(notif.id)
                  }
                  
                  switch (notif.type) {
                    case 'friend_request':
                    case 'friend_accepted':
                      navigate('/friends')
                      break
                    case 'message':
                    case 'call':
                      navigate('/chat')
                      break
                    case 'like':
                    case 'comment':
                    case 'share':
                    case 'repost':
                      navigate('/')
                      break
                  }
                }}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    colorMap[notif.type]
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-800">{notif.message}</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {formatTimeAgo(notif.createdAt)}
                  </p>
                </div>
                {notif.fromUser && (
                  <Avatar
                    src={notif.fromUser.photoURL}
                    name={notif.fromUser.displayName}
                    size="sm"
                  />
                )}
                <div className="flex items-center gap-2">
                  {!notif.read && (
                    <span className="w-2 h-2 bg-zinc-900 rounded-full shrink-0 mt-2" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNotification(notif.id)
                    }}
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-0.5"
                    title="ลบการแจ้งเตือน"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </AppLayout>
  )
}
