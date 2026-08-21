import { useEffect, useState } from 'react'
import { Search, UserPlus, Check, X, MessageCircle } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuth } from '@/contexts/AuthContext'
import {
  getFriends,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  subscribeToFriendRequests,
  getFriendshipStatus,
} from '@/services/friends.service'
import { searchUsersByUsername } from '@/services/auth.service'
import { getOrCreateConversation } from '@/services/chat.service'
import { useNavigate } from 'react-router-dom'
import type { UserProfile, FriendRequest } from '@/types'

export function FriendsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
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
      .then((f) => {
        setFriends(f)
        setLoading(false)
      })
      .catch(() => setLoading(false))
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
      for (const r of results) {
        statuses[r.uid] = 'none'
      }
      setStatusMap({ ...statuses })

      for (const r of results) {
        try {
          statuses[r.uid] = await getFriendshipStatus(user.uid, r.uid)
        } catch {
          // keep 'none'
        }
      }
      setStatusMap({ ...statuses })
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'ค้นหาไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSearching(false)
    }
  }

  const handleAddFriend = async (toUserId: string) => {
    if (!user) return
    await sendFriendRequest(user.uid, toUserId)
    setStatusMap((prev) => ({ ...prev, [toUserId]: 'pending_sent' }))
  }

  const handleAccept = async (requestId: string) => {
    if (!user) return
    await acceptFriendRequest(requestId, user.uid)
    const updated = await getFriends(user.uid)
    setFriends(updated)
  }

  const handleChat = async (friendId: string) => {
    if (!user) return
    await getOrCreateConversation(user.uid, friendId)
    navigate('/chat')
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">เพื่อน</h1>
        <p className="text-zinc-500 text-sm mt-1">ค้นหาและเพิ่มเพื่อนใหม่</p>
      </div>

      {/* Search */}
      <Card className="p-4 mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="ค้นหาด้วย username..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-400"
            />
          </div>
          <Button onClick={handleSearch} loading={searching}>
            ค้นหา
          </Button>
        </div>

        {searchError && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
            ⚠️ {searchError}
          </p>
        )}

        {!searching && !searchError && searchQuery.trim() && searchResults.length === 0 && (
          <p className="mt-3 text-sm text-zinc-500 text-center py-2">ไม่พบผู้ใช้ "{searchQuery}"</p>
        )}

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map((u) => (
              <div
                key={u.uid}
                className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200"
              >
                <Avatar src={u.photoURL} name={u.displayName} size="md" />
                <div className="flex-1">
                  <p className="font-medium text-sm text-zinc-900">{u.displayName}</p>
                  <p className="text-xs text-zinc-500">@{u.username}</p>
                </div>
                {statusMap[u.uid] === 'none' && (
                  <Button size="sm" onClick={() => handleAddFriend(u.uid)}>
                    <UserPlus className="w-4 h-4" />
                    เพิ่มเพื่อน
                  </Button>
                )}
                {statusMap[u.uid] === 'pending_sent' && (
                  <span className="text-xs text-zinc-500">ส่งคำขอแล้ว</span>
                )}
                {statusMap[u.uid] === 'friends' && (
                  <span className="text-xs text-emerald-600 font-medium">เป็นเพื่อนแล้ว</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Friend requests */}
      {requests.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 text-zinc-900">คำขอเป็นเพื่อน ({requests.length})</h2>
          <div className="space-y-2">
            {requests.map((req) => (
              <Card key={req.id} className="p-4 flex items-center gap-3">
                <Avatar
                  src={req.fromUser?.photoURL}
                  name={req.fromUser?.displayName || 'User'}
                  size="md"
                />
                <div className="flex-1">
                  <p className="font-medium text-zinc-900">{req.fromUser?.displayName}</p>
                  <p className="text-xs text-zinc-500">@{req.fromUser?.username}</p>
                </div>
                <Button size="sm" onClick={() => handleAccept(req.id)}>
                  <Check className="w-4 h-4" />
                  ยอมรับ
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => user && rejectFriendRequest(req.id, user.uid)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <h2 className="text-lg font-semibold mb-3 text-zinc-900">เพื่อนทั้งหมด ({friends.length})</h2>
      {loading ? (
        <PageLoader />
      ) : friends.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>ยังไม่มีเพื่อน ค้นหาและเพิ่มเพื่อนใหม่เลย!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {friends.map((friend) => (
            <Card key={friend.uid} className="p-4 flex items-center gap-3">
              <Avatar
                src={friend.photoURL}
                name={friend.displayName}
                size="md"
                online={friend.isOnline}
              />
              <div className="flex-1">
                <p className="font-medium text-zinc-900">{friend.displayName}</p>
                <p className="text-xs text-zinc-500">
                  @{friend.username} · {friend.isOnline ? 'ออนไลน์' : 'ออฟไลน์'}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => handleChat(friend.uid)}>
                <MessageCircle className="w-4 h-4" />
                แชท
              </Button>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  )
}
