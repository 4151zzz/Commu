import { useEffect, useState, useRef } from 'react'
import { Send, Phone, Video, ArrowLeft, Search } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { cn, formatTimeAgo } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  subscribeToConversations,
  subscribeToMessages,
  sendMessage,
  getOrCreateConversation,
} from '@/services/chat.service'
import { getFriends } from '@/services/friends.service'
import { startCall } from '@/components/call/CallManager'
import type { Conversation, Message, UserProfile } from '@/types'

export function ChatPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [friends, setFriends] = useState<UserProfile[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
      otherUser: friend,
    })
  }

  const handleSend = async () => {
    if (!text.trim() || !user || !activeConv?.otherUser) return
    await sendMessage(activeConv.id, user.uid, text.trim(), activeConv.otherUser.uid)
    setText('')
  }

  const otherUser = activeConv?.otherUser

  return (
    <AppLayout>
      <div className="mb-4 lg:mb-0">
        <h1 className="text-2xl font-bold text-zinc-900 lg:hidden">แชท</h1>
      </div>

      <div className="flex h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] rounded-2xl border border-zinc-200 overflow-hidden bg-white shadow-sm">
        {/* Conversation list */}
        <div
          className={cn(
            'w-full lg:w-80 border-r border-zinc-200 flex flex-col bg-white',
            activeConv && 'hidden lg:flex'
          )}
        >
          <div className="p-4 border-b border-zinc-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาเพื่อน..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-100 border border-zinc-200 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <PageLoader />
            ) : (
              <>
                {friends
                  .filter(
                    (f) =>
                      !search ||
                      f.displayName.toLowerCase().includes(search.toLowerCase()) ||
                      f.username.includes(search.toLowerCase())
                  )
                  .map((friend) => (
                    <button
                      key={friend.uid}
                      onClick={() => startChat(friend)}
                      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-zinc-50 transition-all text-left"
                    >
                      <Avatar
                        src={friend.photoURL}
                        name={friend.displayName}
                        size="md"
                        online={friend.isOnline}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate text-zinc-900">{friend.displayName}</p>
                        <p className="text-xs text-zinc-500">@{friend.username}</p>
                      </div>
                    </button>
                  ))}

                {conversations.length > 0 && (
                  <div className="px-4 py-2 text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                    การสนทนา
                  </div>
                )}
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConv(conv)}
                    className={cn(
                      'flex items-center gap-3 w-full px-4 py-3 hover:bg-zinc-50 transition-all text-left',
                      activeConv?.id === conv.id && 'bg-zinc-100'
                    )}
                  >
                    <Avatar
                      src={conv.otherUser?.photoURL}
                      name={conv.otherUser?.displayName || 'User'}
                      size="md"
                      online={conv.otherUser?.isOnline}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate text-zinc-900">
                        {conv.otherUser?.displayName}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">{conv.lastMessage}</p>
                    </div>
                    {conv.lastMessageAt && (
                      <span className="text-[10px] text-zinc-400">
                        {formatTimeAgo(conv.lastMessageAt)}
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Chat room */}
        <div className={cn('flex-1 flex flex-col bg-white', !activeConv && 'hidden lg:flex')}>
          {activeConv && otherUser ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 bg-white">
                <button
                  onClick={() => setActiveConv(null)}
                  className="lg:hidden p-2 -ml-2 text-zinc-500"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <Avatar
                  src={otherUser.photoURL}
                  name={otherUser.displayName}
                  size="md"
                  online={otherUser.isOnline}
                />
                <div className="flex-1">
                  <p className="font-semibold text-zinc-900">{otherUser.displayName}</p>
                  <p className="text-xs text-zinc-500">
                    {otherUser.isOnline ? 'ออนไลน์' : 'ออฟไลน์'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => startCall(otherUser.uid, 'audio')}
                  title="โทรออก"
                >
                  <Phone className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => startCall(otherUser.uid, 'video')}
                  title="วิดีโอคอล"
                >
                  <Video className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50">
                {messages.map((msg) => {
                  const isMe = msg.senderId === user?.uid
                  if (msg.type === 'call') {
                    return (
                      <div key={msg.id} className="flex justify-center my-4">
                        <div className="bg-white border border-zinc-200 px-4 py-2 rounded-full text-xs text-zinc-500 flex items-center gap-2 shadow-sm">
                          {msg.text}
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div
                      key={msg.id}
                      className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[75%] px-4 py-2.5 rounded-2xl text-sm',
                          isMe
                            ? 'bg-zinc-900 text-white rounded-br-md'
                            : 'bg-white text-zinc-800 rounded-bl-md border border-zinc-200 shadow-sm'
                        )}
                      >
                        {msg.text}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-zinc-200 bg-white">
                <div className="flex gap-2">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="พิมพ์ข้อความ..."
                    className="flex-1 px-4 py-3 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-400"
                  />
                  <Button size="icon" onClick={handleSend} disabled={!text.trim()}>
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-400">
              <div className="text-center">
                <p className="text-lg font-medium mb-1 text-zinc-600">เลือกเพื่อนเพื่อเริ่มแชท</p>
                <p className="text-sm">หรือเพิ่มเพื่อนใหม่จากหน้าเพื่อน</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
