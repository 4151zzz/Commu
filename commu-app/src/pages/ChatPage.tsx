import { useEffect, useState, useRef } from 'react'
import {
  Send,
  Phone,
  Video,
  ArrowLeft,
  Search,
  Users,
  Check,
  ShieldAlert,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { cn, formatTimeAgo } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  subscribeToConversations,
  subscribeToMessages,
  sendMessage,
  getOrCreateConversation,
  createGroupConversation,
} from '@/services/chat.service'
import { getFriends } from '@/services/friends.service'
import { blockUser, getBlockedUserIds } from '@/services/blocks.service'
import { startCall } from '@/components/call/CallManager'
import type { Conversation, Message, UserProfile } from '@/types'

export function ChatPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [friends, setFriends] = useState<UserProfile[]>([])
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNewGroupModal, setShowNewGroupModal] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    getBlockedUserIds(user.uid).then(setBlockedUserIds)

    const unsub = subscribeToConversations(user.uid, (data) => {
      setConversations(data)
      setLoading(false)
    })
    getFriends(user.uid).then(setFriends)
    return unsub
  }, [user])

  useEffect(() => {
    if (!activeConv) return
    return subscribeToMessages(activeConv.id, setMessages)
  }, [activeConv])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startChat = async (friend: UserProfile) => {
    if (!user) return
    const convId = await getOrCreateConversation(user.uid, friend.uid)
    setActiveConv({
      id: convId,
      participants: [user.uid, friend.uid],
      lastMessage: '',
      lastMessageAt: null,
      updatedAt: null,
      isGroup: false,
      otherUser: friend,
    })
  }

  const handleSend = async () => {
    if (!text.trim() || !user || !activeConv) return
    const recipientId = activeConv.isGroup ? undefined : activeConv.otherUser?.uid
    await sendMessage(activeConv.id, user.uid, text.trim(), recipientId)
    setText('')
  }

  const handleToggleFriendSelection = (friendUid: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(friendUid) ? prev.filter((id) => id !== friendUid) : [...prev, friendUid]
    )
  }

  const handleCreateGroup = async () => {
    if (!user || !groupName.trim() || selectedFriendIds.length === 0) return
    setCreatingGroup(true)
    try {
      const convId = await createGroupConversation(user.uid, selectedFriendIds, groupName.trim())
      setShowNewGroupModal(false)
      setGroupName('')
      setSelectedFriendIds([])
      setActiveConv({
        id: convId,
        participants: [user.uid, ...selectedFriendIds],
        lastMessage: 'สร้างกลุ่มแชทเรียบร้อยแล้ว 🎉',
        lastMessageAt: new Date(),
        updatedAt: new Date(),
        isGroup: true,
        groupName: groupName.trim(),
      })
    } finally {
      setCreatingGroup(false)
    }
  }

  const handleBlockCurrentChatUser = async () => {
    if (!user || !activeConv?.otherUser) return
    if (confirm(`คุณต้องการบล็อก ${activeConv.otherUser.displayName} ใช่หรือไม่?`)) {
      await blockUser(user.uid, activeConv.otherUser.uid)
      setBlockedUserIds((prev) => [...prev, activeConv.otherUser!.uid])
      setActiveConv(null)
    }
  }

  // Filter out blocked users from conversations & friends
  const filteredFriends = friends
    .filter((f) => !blockedUserIds.includes(f.uid))
    .filter(
      (f) =>
        !search ||
        f.displayName.toLowerCase().includes(search.toLowerCase()) ||
        f.username.includes(search.toLowerCase())
    )

  const filteredConversations = conversations.filter((conv) => {
    if (conv.isGroup) return true
    return !conv.otherUser || !blockedUserIds.includes(conv.otherUser.uid)
  })

  const otherUser = activeConv?.otherUser
  const isGroup = activeConv?.isGroup

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">แชท</h1>
        <Button
          size="sm"
          onClick={() => setShowNewGroupModal(true)}
          className="flex items-center gap-1.5 shadow-sm text-xs"
        >
          <Users className="w-4 h-4" />
          สร้างกลุ่มแชท
        </Button>
      </div>

      <div className="flex h-[calc(100vh-10rem)] lg:h-[calc(100vh-8rem)] rounded-2xl border border-zinc-200 overflow-hidden bg-white shadow-sm">
        {/* Conversation list */}
        <div
          className={cn(
            'w-full lg:w-80 border-r border-zinc-200 flex flex-col bg-white',
            activeConv && 'hidden lg:flex'
          )}
        >
          <div className="p-3 border-b border-zinc-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาเพื่อนหรือกลุ่ม..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-100 border border-zinc-200 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <PageLoader />
            ) : (
              <>
                {/* Active Conversations */}
                {filteredConversations.length > 0 && (
                  <div className="px-4 py-2 text-[11px] text-zinc-400 uppercase tracking-wider font-bold">
                    การสนทนาทั้งหมด
                  </div>
                )}
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConv(conv)}
                    className={cn(
                      'flex items-center gap-3 w-full px-4 py-3 hover:bg-zinc-50 transition-all text-left border-b border-zinc-100/50',
                      activeConv?.id === conv.id && 'bg-zinc-100'
                    )}
                  >
                    {conv.isGroup ? (
                      <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        <Users className="w-5 h-5" />
                      </div>
                    ) : (
                      <Avatar
                        src={conv.otherUser?.photoURL}
                        name={conv.otherUser?.displayName || 'User'}
                        size="md"
                        online={conv.otherUser?.isOnline}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-semibold text-sm truncate text-zinc-900">
                          {conv.isGroup ? conv.groupName : conv.otherUser?.displayName}
                        </p>
                        {conv.lastMessageAt && (
                          <span className="text-[10px] text-zinc-400 shrink-0">
                            {formatTimeAgo(conv.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{conv.lastMessage || 'ไม่มีข้อความ'}</p>
                    </div>
                  </button>
                ))}

                {/* Direct Friends List */}
                {filteredFriends.length > 0 && (
                  <div className="px-4 py-2 text-[11px] text-zinc-400 uppercase tracking-wider font-bold mt-2">
                    เพื่อนของคุณ ({filteredFriends.length})
                  </div>
                )}
                {filteredFriends.map((friend) => (
                  <button
                    key={friend.uid}
                    onClick={() => startChat(friend)}
                    className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-zinc-50 transition-all text-left"
                  >
                    <Avatar
                      src={friend.photoURL}
                      name={friend.displayName}
                      size="sm"
                      online={friend.isOnline}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate text-zinc-900">{friend.displayName}</p>
                      <p className="text-[10px] text-zinc-400">@{friend.username}</p>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Chat room */}
        <div className={cn('flex-1 flex flex-col bg-white min-w-0', !activeConv && 'hidden lg:flex')}>
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 bg-white">
                <button
                  onClick={() => setActiveConv(null)}
                  className="lg:hidden p-1.5 -ml-2 text-zinc-600 hover:bg-zinc-100 rounded-lg"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                {isGroup ? (
                  <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                ) : (
                  <Avatar
                    src={otherUser?.photoURL}
                    name={otherUser?.displayName || 'User'}
                    size="md"
                    online={otherUser?.isOnline}
                  />
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-zinc-900 truncate text-sm sm:text-base">
                    {isGroup ? activeConv.groupName : otherUser?.displayName}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {isGroup
                      ? `สมาชิก ${activeConv.participants.length} คน`
                      : otherUser?.isOnline
                      ? 'ออนไลน์'
                      : 'ออฟไลน์'}
                  </p>
                </div>

                {!isGroup && otherUser && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startCall(otherUser.uid, 'audio')}
                      title="โทรออก"
                    >
                      <Phone className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startCall(otherUser.uid, 'video')}
                      title="วิดีโอคอล"
                    >
                      <Video className="w-4 h-4" />
                    </Button>
                    <button
                      onClick={handleBlockCurrentChatUser}
                      className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="บล็อกผู้ใช้นี้"
                    >
                      <ShieldAlert className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50">
                {messages.map((msg) => {
                  const isMe = msg.senderId === user?.uid
                  if (msg.type === 'call') {
                    return (
                      <div key={msg.id} className="flex justify-center my-4">
                        <div className="bg-white border border-zinc-200 px-4 py-1.5 rounded-full text-xs text-zinc-500 flex items-center gap-2 shadow-sm">
                          {msg.text}
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div
                      key={msg.id}
                      className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}
                    >
                      {/* Show sender name in group chat */}
                      {isGroup && !isMe && msg.senderName && (
                        <span className="text-[10px] text-zinc-400 mb-1 ml-2 font-medium">
                          {msg.senderName}
                        </span>
                      )}
                      <div
                        className={cn(
                          'max-w-[80%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm',
                          isMe
                            ? 'bg-zinc-900 text-white rounded-br-md'
                            : 'bg-white text-zinc-800 rounded-bl-md border border-zinc-200'
                        )}
                      >
                        {msg.text}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              <div className="p-3 sm:p-4 border-t border-zinc-200 bg-white">
                <div className="flex gap-2">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={isGroup ? `ส่งข้อความถึงกลุ่ม ${activeConv.groupName}...` : 'พิมพ์ข้อความ...'}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 text-sm"
                  />
                  <Button size="icon" onClick={handleSend} disabled={!text.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-400 p-6 text-center">
              <div>
                <Users className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
                <p className="text-base font-semibold text-zinc-700">เลือกเพื่อนหรือกลุ่มเพื่อเริ่มแชท</p>
                <p className="text-xs text-zinc-400 mt-1">หรือกดปุ่ม "สร้างกลุ่มแชท" เพื่อคุยพร้อมกันหลายคน</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Chat Modal */}
      <Modal open={showNewGroupModal} onClose={() => setShowNewGroupModal(false)} title="สร้างกลุ่มแชทใหม่">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-700 block mb-1.5">ชื่อกลุ่มแชท</label>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="เช่น กลุ่มเพื่อนสนิท, งานโปรเจกต์..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
              เลือกเพื่อนเข้ากลุ่ม ({selectedFriendIds.length} คน)
            </label>
            <div className="max-h-60 overflow-y-auto space-y-1.5 border border-zinc-200 rounded-xl p-2 bg-zinc-50">
              {friends.length === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-6">คุณยังไม่มีเพื่อนให้เพิ่มเข้ากลุ่ม</p>
              ) : (
                friends.map((friend) => {
                  const isSelected = selectedFriendIds.includes(friend.uid)
                  return (
                    <div
                      key={friend.uid}
                      onClick={() => handleToggleFriendSelection(friend.uid)}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors',
                        isSelected ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-200/60 text-zinc-900'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar src={friend.photoURL} name={friend.displayName} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{friend.displayName}</p>
                          <p className={cn('text-[10px] truncate', isSelected ? 'text-zinc-300' : 'text-zinc-400')}>
                            @{friend.username}
                          </p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'w-5 h-5 rounded-md flex items-center justify-center border',
                          isSelected ? 'bg-white text-zinc-900 border-white' : 'border-zinc-300 bg-white'
                        )}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setShowNewGroupModal(false)}
            >
              ยกเลิก
            </Button>
            <Button
              className="flex-1"
              loading={creatingGroup}
              disabled={!groupName.trim() || selectedFriendIds.length === 0}
              onClick={handleCreateGroup}
            >
              สร้างกลุ่ม
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}
