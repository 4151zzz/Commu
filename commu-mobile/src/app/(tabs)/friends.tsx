import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native'
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '@/contexts/AuthContext'
import {
  getFriends,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  subscribeToFriendRequests,
} from '@/services/friends.service'
import { searchUsersByUsername, getFriendshipStatus } from '@/services/auth.service'
import { getOrCreateConversation } from '@/services/chat.service'
import type { UserProfile, FriendRequest } from '@/types'
import { getAvatarColor } from '@/lib/utils'

function Avatar({ name, photoURL, size = 44, online }: { name?: string; photoURL?: string; size?: number; online?: boolean }) {
  const [error, setError] = useState(false)
  const initials = (name || 'U').charAt(0).toUpperCase()
  const bg = getAvatarColor(name || 'U')
  if (photoURL && !error) {
    return (
      <View style={{ width: size, height: size }}>
        <Image source={{ uri: photoURL }} style={{ width: size, height: size, borderRadius: size / 2 }} onError={() => setError(true)} />
        {online !== undefined && (
          <View style={[styles.onlineDot, { backgroundColor: online ? '#22c55e' : '#52525b' }]} />
        )}
      </View>
    )
  }
  return (
    <View style={{ width: size, height: size }}>
      <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, styles.avatarFallback]}>
        <Text style={[styles.avatarInitials, { fontSize: size * 0.42 }]}>{initials}</Text>
      </View>
      {online !== undefined && (
        <View style={[styles.onlineDot, { backgroundColor: online ? '#22c55e' : '#52525b' }]} />
      )}
    </View>
  )
}

export default function FriendsScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const [friends, setFriends] = useState<UserProfile[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserProfile[]>([])
  const [statusMap, setStatusMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  useEffect(() => {
    if (!user) return
    getFriends(user.uid)
      .then(setFriends)
      .finally(() => setLoading(false))
    return subscribeToFriendRequests(user.uid, setRequests)
  }, [user])

  const handleSearch = async () => {
    if (!user || !searchQuery.trim()) return
    setSearching(true)
    setSearchError('')
    try {
      const results = await searchUsersByUsername(searchQuery.trim(), user.uid)
      setSearchResults(results)

      const statuses: Record<string, string> = {}
      for (const r of results) statuses[r.uid] = 'none'
      setStatusMap({ ...statuses })

      for (const r of results) {
        try {
          statuses[r.uid] = await getFriendshipStatus(user.uid, r.uid)
        } catch { /* keep 'none' */ }
      }
      setStatusMap({ ...statuses })
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'ค้นหาไม่สำเร็จ')
    } finally {
      setSearching(false)
    }
  }

  const handleAddFriend = async (toUserId: string) => {
    if (!user) return
    try {
      await sendFriendRequest(user.uid, toUserId)
      setStatusMap((prev) => ({ ...prev, [toUserId]: 'pending_sent' }))
    } catch (err) {
      Alert.alert('ไม่สำเร็จ', err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    }
  }

  const handleAccept = async (req: FriendRequest) => {
    if (!user) return
    await acceptFriendRequest(req.id, user.uid)
    const updated = await getFriends(user.uid)
    setFriends(updated)
  }

  const handleReject = async (req: FriendRequest) => {
    if (!user) return
    await rejectFriendRequest(req.id, user.uid)
  }

  const handleChat = async (friendId: string) => {
    if (!user) return
    await getOrCreateConversation(user.uid, friendId)
    // Navigate to chat tab
    router.push('/(tabs)/chat')
  }

  const sections = [
    ...(searchResults.length > 0 || searchError ? [{ type: 'search-results' as const }] : []),
    ...(requests.length > 0 ? [{ type: 'requests-header' as const }] : []),
    ...requests.map((r) => ({ type: 'request' as const, data: r })),
    { type: 'friends-header' as const },
    ...friends.map((f) => ({ type: 'friend' as const, data: f })),
  ]

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.header}>
        <Text style={styles.title}>เพื่อน</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          placeholder="ค้นหาด้วย username..."
          placeholderTextColor="#52525b"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
          {searching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>ค้นหา</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#7c3aed" />
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item, i) => item.type + i}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            if (item.type === 'search-results') {
              return (
                <View style={styles.card}>
                  {searchError ? (
                    <Text style={styles.errorText}>⚠️ {searchError}</Text>
                  ) : searchResults.length === 0 ? (
                    <Text style={styles.emptyText}>ไม่พบผู้ใช้ "{searchQuery}"</Text>
                  ) : (
                    searchResults.map((u) => (
                      <View key={u.uid} style={styles.resultRow}>
                        <Avatar name={u.displayName} photoURL={u.photoURL} size={40} />
                        <View style={styles.resultInfo}>
                          <Text style={styles.resultName}>{u.displayName}</Text>
                          <Text style={styles.resultHandle}>@{u.username}</Text>
                        </View>
                        {statusMap[u.uid] === 'none' && (
                          <TouchableOpacity style={styles.addBtn} onPress={() => handleAddFriend(u.uid)}>
                            <Text style={styles.addBtnText}>+ เพิ่ม</Text>
                          </TouchableOpacity>
                        )}
                        {statusMap[u.uid] === 'pending_sent' && (
                          <Text style={styles.sentText}>ส่งแล้ว</Text>
                        )}
                        {statusMap[u.uid] === 'friends' && (
                          <Text style={styles.friendText}>เพื่อน ✓</Text>
                        )}
                      </View>
                    ))
                  )}
                </View>
              )
            }

            if (item.type === 'requests-header') {
              return <Text style={styles.sectionLabel}>คำขอเป็นเพื่อน ({requests.length})</Text>
            }

            if (item.type === 'request') {
              const req = item.data as FriendRequest
              return (
                <View style={styles.card}>
                  <View style={styles.reqRow}>
                    <Avatar name={req.fromUser?.displayName} photoURL={req.fromUser?.photoURL} size={44} />
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultName}>{req.fromUser?.displayName}</Text>
                      <Text style={styles.resultHandle}>@{req.fromUser?.username}</Text>
                    </View>
                    <View style={styles.reqActions}>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(req)}>
                        <Text style={styles.acceptBtnText}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(req)}>
                        <Text style={styles.rejectBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )
            }

            if (item.type === 'friends-header') {
              return <Text style={styles.sectionLabel}>เพื่อนทั้งหมด ({friends.length})</Text>
            }

            if (item.type === 'friend') {
              const f = item.data as UserProfile
              return (
                <View style={styles.card}>
                  <View style={styles.reqRow}>
                    <Avatar name={f.displayName} photoURL={f.photoURL} size={44} online={f.isOnline} />
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultName}>{f.displayName}</Text>
                      <Text style={styles.resultHandle}>
                        @{f.username} · {f.isOnline ? '🟢 ออนไลน์' : '⚫ ออฟไลน์'}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.chatBtn} onPress={() => handleChat(f.uid)}>
                      <Text style={styles.chatBtnText}>แชท</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            }

            return null
          }}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>ยังไม่มีเพื่อน ค้นหาและเพิ่มเพื่อนใหม่เลย!</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 16, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff' },

  // Avatar
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '700' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#0a0a0f' },

  // Search
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  listContent: { padding: 12, gap: 8 },
  sectionLabel: { color: '#71717a', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', paddingVertical: 8, paddingLeft: 4, letterSpacing: 1 },

  card: {
    backgroundColor: '#14141e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 12,
    gap: 10,
    marginBottom: 4,
  },

  // Search results
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultInfo: { flex: 1 },
  resultName: { color: '#fff', fontWeight: '600', fontSize: 14 },
  resultHandle: { color: '#71717a', fontSize: 12, marginTop: 2 },
  addBtn: { backgroundColor: '#7c3aed', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  sentText: { color: '#71717a', fontSize: 12 },
  friendText: { color: '#22c55e', fontSize: 12 },

  // Requests
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reqActions: { flexDirection: 'row', gap: 6 },
  acceptBtn: { backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  rejectBtn: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 },
  rejectBtnText: { color: '#f87171', fontWeight: '700', fontSize: 15 },

  // Friends
  chatBtn: { borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 },
  chatBtnText: { color: '#a78bfa', fontWeight: '600', fontSize: 13 },

  errorText: { color: '#f87171', fontSize: 13 },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: '#71717a', fontSize: 14, textAlign: 'center' },
})
