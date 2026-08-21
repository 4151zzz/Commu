import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  subscribeToConversations,
  subscribeToMessages,
  sendMessage,
  getOrCreateConversation,
} from '@/services/chat.service'
import { getFriends } from '@/services/friends.service'
import type { Conversation, Message, UserProfile } from '@/types'
import { formatTimeAgo, getAvatarColor } from '@/lib/utils'

function Avatar({ name, photoURL, size = 40, online }: { name?: string; photoURL?: string; size?: number; online?: boolean }) {
  const [error, setError] = useState(false)
  const initials = (name || 'U').charAt(0).toUpperCase()
  const bg = getAvatarColor(name || 'U')

  if (photoURL && !error) {
    return (
      <View style={{ width: size, height: size }}>
        <Image
          source={{ uri: photoURL }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setError(true)}
        />
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

export default function ChatScreen() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [friends, setFriends] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const flatListRef = useRef<FlatList>(null)

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToConversations(user.uid, (data) => {
      setConversations(data)
      setLoading(false)
    })
    getFriends(user.uid).then(setFriends)
    return unsub
  }, [user])

  useEffect(() => {
    if (!activeConv) return
    return subscribeToMessages(activeConv.id, (msgs) => {
      setMessages(msgs)
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    })
  }, [activeConv])

  const startChat = async (friend: UserProfile) => {
    if (!user) return
    const convId = await getOrCreateConversation(user.uid, friend.uid)
    setActiveConv({
      id: convId,
      participants: [user.uid, friend.uid],
      lastMessage: '',
      lastMessageAt: null,
      updatedAt: null,
      otherUser: friend,
    })
  }

  const handleSend = async () => {
    if (!text.trim() || !user || !activeConv) return
    const t = text.trim()
    setText('')
    await sendMessage(activeConv.id, user.uid, t, activeConv.otherUser?.uid)
  }

  const filteredFriends = friends.filter(
    (f) =>
      !search ||
      f.displayName.toLowerCase().includes(search.toLowerCase()) ||
      f.username.includes(search.toLowerCase())
  )

  // ─── Chat Room ────────────────────────────────────────────────────────────
  if (activeConv) {
    const other = activeConv.otherUser
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setActiveConv(null)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>
          <Avatar name={other?.displayName} photoURL={other?.photoURL} size={36} online={other?.isOnline} />
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatHeaderName}>{other?.displayName}</Text>
            <Text style={styles.chatHeaderStatus}>{other?.isOnline ? 'ออนไลน์' : 'ออฟไลน์'}</Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: msg }) => {
            const isMe = msg.senderId === user?.uid
            if (msg.type === 'call') {
              return (
                <View style={styles.callMessage}>
                  <Text style={styles.callMessageText}>{msg.text}</Text>
                </View>
              )
            }
            return (
              <View style={[styles.messageBubbleWrap, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
                <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                  <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextOther]}>
                    {msg.text}
                  </Text>
                </View>
              </View>
            )
          }}
        />

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.messageInput}
            value={text}
            onChangeText={setText}
            placeholder="พิมพ์ข้อความ..."
            placeholderTextColor="#52525b"
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!text.trim()}
          >
            <Text style={styles.sendButtonText}>ส่ง</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    )
  }

  // ─── Conversation List ────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>แชท</Text>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="ค้นหาเพื่อน..."
          placeholderTextColor="#52525b"
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#7c3aed" />
        </View>
      ) : (
        <FlatList
          data={[
            ...filteredFriends.map((f) => ({ type: 'friend' as const, data: f })),
            ...(conversations.length > 0 ? [{ type: 'divider' as const, data: null }] : []),
            ...conversations.map((c) => ({ type: 'conv' as const, data: c })),
          ]}
          keyExtractor={(item, i) => item.type + i}
          renderItem={({ item }) => {
            if (item.type === 'divider') {
              return <Text style={styles.sectionLabel}>การสนทนา</Text>
            }
            if (item.type === 'friend') {
              const f = item.data as UserProfile
              return (
                <TouchableOpacity style={styles.listItem} onPress={() => startChat(f)}>
                  <Avatar name={f.displayName} photoURL={f.photoURL} size={44} online={f.isOnline} />
                  <View style={styles.listItemInfo}>
                    <Text style={styles.listItemName}>{f.displayName}</Text>
                    <Text style={styles.listItemSub}>@{f.username}</Text>
                  </View>
                  <Text style={styles.chatNowBtn}>แชท</Text>
                </TouchableOpacity>
              )
            }
            const c = item.data as Conversation
            return (
              <TouchableOpacity style={styles.listItem} onPress={() => setActiveConv(c)}>
                <Avatar name={c.otherUser?.displayName} photoURL={c.otherUser?.photoURL} size={44} online={c.otherUser?.isOnline} />
                <View style={styles.listItemInfo}>
                  <Text style={styles.listItemName}>{c.otherUser?.displayName}</Text>
                  <Text style={styles.listItemSub} numberOfLines={1}>{c.lastMessage || 'เริ่มแชท'}</Text>
                </View>
                {c.lastMessageAt && (
                  <Text style={styles.listItemTime}>{formatTimeAgo(c.lastMessageAt)}</Text>
                )}
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>เพิ่มเพื่อนเพื่อเริ่มแชท</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Avatar
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '700' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#0a0a0f' },

  // List header
  listHeader: { paddingHorizontal: 16, paddingTop: 16, marginBottom: 8 },
  listTitle: { fontSize: 24, fontWeight: '700', color: '#fff' },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 12, fontSize: 14 },

  // Section label
  sectionLabel: { color: '#71717a', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', paddingHorizontal: 16, paddingVertical: 8, letterSpacing: 1 },

  // List items
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  listItemInfo: { flex: 1, gap: 2 },
  listItemName: { color: '#fff', fontWeight: '600', fontSize: 14 },
  listItemSub: { color: '#71717a', fontSize: 12 },
  listItemTime: { color: '#52525b', fontSize: 11 },
  chatNowBtn: { color: '#7c3aed', fontSize: 13, fontWeight: '600' },

  // Chat room
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingTop: Platform.OS === 'ios' ? 52 : 20,
  },
  backBtn: { padding: 4, marginRight: 4 },
  backBtnText: { color: '#7c3aed', fontSize: 32, lineHeight: 32 },
  chatHeaderInfo: { flex: 1 },
  chatHeaderName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  chatHeaderStatus: { color: '#71717a', fontSize: 12 },

  messagesList: { padding: 16, gap: 8, flexGrow: 1 },
  messageBubbleWrap: { marginBottom: 6 },
  messageBubbleMe: { alignItems: 'flex-end' },
  messageBubbleOther: { alignItems: 'flex-start' },
  messageBubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMe: { backgroundColor: '#7c3aed', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#1e1e2e', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  messageText: { fontSize: 14, lineHeight: 20 },
  messageTextMe: { color: '#fff' },
  messageTextOther: { color: '#e4e4e7' },
  callMessage: { alignItems: 'center', marginVertical: 8 },
  callMessageText: { color: '#71717a', fontSize: 12, backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },

  inputBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  messageInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: { backgroundColor: '#7c3aed', borderRadius: 14, paddingHorizontal: 16, justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: '#71717a', fontSize: 14 },
})
