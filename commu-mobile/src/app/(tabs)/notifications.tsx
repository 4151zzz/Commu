import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native'
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '@/contexts/AuthContext'
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  cleanupOldNotifications,
} from '@/services/notifications.service'
import type { AppNotification } from '@/types'
import { formatTimeAgo, getAvatarColor } from '@/lib/utils'

const iconMap: Record<string, string> = {
  friend_request: '👤',
  friend_accepted: '✅',
  like: '❤️',
  comment: '💬',
  message: '✉️',
  share: '📤',
  repost: '🔄',
  call: '📞',
}

const bgMap: Record<string, string> = {
  friend_request: 'rgba(59,130,246,0.12)',
  friend_accepted: 'rgba(34,197,94,0.12)',
  like: 'rgba(244,63,94,0.12)',
  comment: 'rgba(59,130,246,0.12)',
  message: 'rgba(124,58,237,0.12)',
  share: 'rgba(34,197,94,0.12)',
  repost: 'rgba(99,102,241,0.12)',
  call: 'rgba(245,158,11,0.12)',
}

function Avatar({ name, photoURL, size = 36 }: { name?: string; photoURL?: string; size?: number }) {
  const [error, setError] = useState(false)
  const initials = (name || 'U').charAt(0).toUpperCase()
  const bg = getAvatarColor(name || 'U')
  if (photoURL && !error) {
    return <Image source={{ uri: photoURL }} style={{ width: size, height: size, borderRadius: size / 2 }} onError={() => setError(true)} />
  }
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, styles.avatarFallback]}>
      <Text style={[styles.avatarInitials, { fontSize: size * 0.42 }]}>{initials}</Text>
    </View>
  )
}

export default function NotificationsScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    cleanupOldNotifications(user.uid).catch(console.error)
    const unsub = subscribeToNotifications(user.uid, (data) => {
      setNotifications(data)
      setLoading(false)
    })
    return unsub
  }, [user])

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleTap = async (notif: AppNotification) => {
    if (!notif.read) {
      await markNotificationRead(notif.id)
    }
    switch (notif.type) {
      case 'friend_request':
      case 'friend_accepted':
        router.push('/(tabs)/friends')
        break
      case 'message':
      case 'call':
        router.push('/(tabs)/chat')
        break
      case 'like':
      case 'comment':
      case 'share':
      case 'repost':
        router.push('/(tabs)')
        break
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>แจ้งเตือน</Text>
          <Text style={styles.subtitle}>
            {unreadCount > 0 ? `${unreadCount} รายการใหม่` : 'ไม่มีแจ้งเตือนใหม่'}
          </Text>
        </View>
        {unreadCount > 0 && user && (
          <TouchableOpacity
            style={styles.readAllBtn}
            onPress={() => markAllNotificationsRead(user.uid)}
          >
            <Text style={styles.readAllBtnText}>✓✓ อ่านทั้งหมด</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#7c3aed" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>ยังไม่มีการแจ้งเตือน</Text>
            </View>
          }
          renderItem={({ item: notif }) => (
            <TouchableOpacity
              style={[styles.notifCard, !notif.read && styles.notifUnread]}
              onPress={() => handleTap(notif)}
              activeOpacity={0.85}
            >
              {/* Icon */}
              <View style={[styles.iconBox, { backgroundColor: bgMap[notif.type] || 'rgba(255,255,255,0.06)' }]}>
                <Text style={styles.notifIcon}>{iconMap[notif.type] || '🔔'}</Text>
              </View>

              {/* Text */}
              <View style={styles.notifBody}>
                <Text style={styles.notifMessage}>{notif.message}</Text>
                {notif.createdAt && (
                  <Text style={styles.notifTime}>{formatTimeAgo(notif.createdAt)}</Text>
                )}
              </View>

              {/* Avatar + unread dot + delete */}
              <View style={styles.notifRight}>
                {notif.fromUser && (
                  <Avatar name={notif.fromUser.displayName} photoURL={notif.fromUser.photoURL} size={32} />
                )}
                <View style={styles.notifMeta}>
                  {!notif.read && <View style={styles.unreadDot} />}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation?.()
                      deleteNotification(notif.id)
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.deleteIcon}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 2 },
  subtitle: { fontSize: 13, color: '#71717a' },
  readAllBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  readAllBtnText: { color: '#a1a1aa', fontSize: 13 },

  // Avatar
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '700' },

  listContent: { padding: 12, gap: 8 },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#14141e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 14,
  },
  notifUnread: {
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderColor: 'rgba(124,58,237,0.2)',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifIcon: { fontSize: 20 },
  notifBody: { flex: 1 },
  notifMessage: { color: '#e4e4e7', fontSize: 13, lineHeight: 18 },
  notifTime: { color: '#71717a', fontSize: 11, marginTop: 4 },
  notifRight: { alignItems: 'flex-end', gap: 6 },
  notifMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7c3aed' },
  deleteIcon: { fontSize: 14, opacity: 0.5 },

  emptyContainer: { alignItems: 'center', paddingVertical: 64 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: '#71717a', fontSize: 14 },
})
