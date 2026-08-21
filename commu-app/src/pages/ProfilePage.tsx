import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, Link as LinkIcon, UserPlus, MessageCircle, Phone, Video, Check } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { PostCard } from '@/components/social/PostCard'
import { ImageViewerModal } from '@/components/ui/ImageViewerModal'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuth } from '@/contexts/AuthContext'
import { updateUserProfile, getUserProfile } from '@/services/auth.service'
import { invalidateProfileCache, getUserPosts } from '@/services/posts.service'
import {
  getFriends,
  getFriendshipStatus,
  sendFriendRequest,
} from '@/services/friends.service'
import { getOrCreateConversation } from '@/services/chat.service'
import { startCall } from '@/components/call/CallManager'
import { uploadImage } from '@/services/storage.service'
import type { Post, UserProfile } from '@/types'

export function ProfilePage() {
  const { userId: routeUserId } = useParams<{ userId?: string }>()
  const { user, profile: myProfile } = useAuth()
  const navigate = useNavigate()

  // If no routeUserId, or routeUserId === user.uid, we are viewing own profile
  const isOwnProfile = !routeUserId || routeUserId === user?.uid
  const targetUserId = isOwnProfile ? user?.uid : routeUserId

  const [viewProfile, setViewProfile] = useState<UserProfile | null>(isOwnProfile ? myProfile : null)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [username, setUsername] = useState('')
  const [photoURL, setPhotoURL] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [posts, setPosts] = useState<Post[]>([])
  const [friends, setFriends] = useState<UserProfile[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'photos'>('all')
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [postsLoading, setPostsLoading] = useState(true)
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [saveError, setSaveError] = useState('')
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'friends'>('none')
  const [requestSending, setRequestSending] = useState(false)

  const photos = posts.flatMap((p) => p.images || [])

  // Load target profile
  useEffect(() => {
    if (!targetUserId) return

    if (isOwnProfile && myProfile) {
      setViewProfile(myProfile)
      setDisplayName(myProfile.displayName)
      setBio(myProfile.bio || '')
      setUsername(myProfile.username)
      setPhotoURL(myProfile.photoURL || '')
      setPhotoPreview(myProfile.photoURL || '')
    } else if (!isOwnProfile) {
      getUserProfile(targetUserId).then((p) => {
        if (p) {
          setViewProfile(p)
          setDisplayName(p.displayName)
          setBio(p.bio || '')
          setUsername(p.username)
          setPhotoURL(p.photoURL || '')
        }
      })
    }
  }, [targetUserId, isOwnProfile, myProfile])

  // Load friendship status
  useEffect(() => {
    if (!user || isOwnProfile || !targetUserId) return
    getFriendshipStatus(user.uid, targetUserId).then(setFriendshipStatus)
  }, [user, targetUserId, isOwnProfile])

  // Load posts & friends
  useEffect(() => {
    if (!targetUserId) return
    setPostsLoading(true)
    setFriendsLoading(true)

    getUserPosts(targetUserId)
      .then((p) => setPosts(p))
      .catch((err) => console.error('Failed to load posts:', err))
      .finally(() => setPostsLoading(false))

    getFriends(targetUserId)
      .then((f) => setFriends(f))
      .catch((err) => console.error('Failed to load friends:', err))
      .finally(() => setFriendsLoading(false))
  }, [targetUserId])

  const handleSave = async () => {
    if (!user) return
    setSaveError('')
    setLoading(true)
    try {
      let finalPhotoUrl = photoURL

      if (photoFile) {
        finalPhotoUrl = await uploadImage(photoFile)
        setPhotoURL(finalPhotoUrl)
      }

      await updateUserProfile(user.uid, { displayName, bio, username, photoURL: finalPhotoUrl })
      invalidateProfileCache(user.uid)
      setEditing(false)
      setPhotoFile(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่'
      setSaveError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleAddFriend = async () => {
    if (!user || !targetUserId) return
    setRequestSending(true)
    try {
      await sendFriendRequest(user.uid, targetUserId)
      setFriendshipStatus('pending_sent')
    } catch (err) {
      console.error(err)
    } finally {
      setRequestSending(false)
    }
  }

  const handleStartChat = async () => {
    if (!user || !targetUserId) return
    await getOrCreateConversation(user.uid, targetUserId)
    navigate('/chat')
  }

  if (!viewProfile) return <PageLoader />

  return (
    <AppLayout>
      <Card className="p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar preview */}
          <div className="relative">
            <Avatar
              src={editing ? photoPreview : viewProfile.photoURL}
              name={viewProfile.displayName}
              size="xl"
            />
          </div>

          <div className="flex-1 text-center sm:text-left w-full">
            {editing && isOwnProfile ? (
              <div className="space-y-3">
                <Input
                  id="displayName"
                  label="ชื่อที่แสดง"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <Input
                  id="username"
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <Input
                  id="bio"
                  label="Bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
                {/* Photo file input */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-zinc-700 font-medium flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" />
                    รูปโปรไฟล์
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setPhotoFile(file)
                        setPhotoPreview(URL.createObjectURL(file))
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-300 text-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                  />
                  {photoPreview && (
                    <p className="text-xs text-zinc-500">ดูรูปตัวอย่างที่ภาพโปรไฟล์ด้านซ้าย</p>
                  )}
                </div>

                {saveError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                    ⚠️ {saveError}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleSave} loading={loading} size="sm">
                    <Save className="w-4 h-4" />
                    บันทึก
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(false)
                      setSaveError('')
                      setDisplayName(viewProfile.displayName)
                      setBio(viewProfile.bio || '')
                      setUsername(viewProfile.username)
                      setPhotoURL(viewProfile.photoURL || '')
                      setPhotoPreview(viewProfile.photoURL || '')
                      setPhotoFile(null)
                    }}
                  >
                    ยกเลิก
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-zinc-900">{viewProfile.displayName}</h1>
                    <p className="text-zinc-500">@{viewProfile.username}</p>
                  </div>

                  {/* Actions for Other Users vs Own Profile */}
                  <div className="flex items-center justify-center sm:justify-end gap-2 flex-wrap">
                    {isOwnProfile ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(true)}
                      >
                        แก้ไขโปรไฟล์
                      </Button>
                    ) : (
                      <>
                        {friendshipStatus === 'none' && (
                          <Button
                            size="sm"
                            onClick={handleAddFriend}
                            loading={requestSending}
                          >
                            <UserPlus className="w-4 h-4" />
                            เพิ่มเพื่อน
                          </Button>
                        )}
                        {friendshipStatus === 'pending_sent' && (
                          <span className="text-xs text-zinc-500 bg-zinc-100 border border-zinc-200 px-3 py-1.5 rounded-xl font-medium">
                            ส่งคำขอแล้ว
                          </span>
                        )}
                        {friendshipStatus === 'pending_received' && (
                          <Button
                            size="sm"
                            onClick={() => navigate('/friends')}
                          >
                            <Check className="w-4 h-4" />
                            ตอบรับคำขอ
                          </Button>
                        )}
                        {friendshipStatus === 'friends' && (
                          <>
                            <Button variant="secondary" size="sm" onClick={handleStartChat}>
                              <MessageCircle className="w-4 h-4" />
                              แชท
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => startCall(targetUserId!, 'audio')}
                              title="โทรด้วยเสียง"
                            >
                              <Phone className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => startCall(targetUserId!, 'video')}
                              title="วิดีโอคอล"
                            >
                              <Video className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {viewProfile.bio && <p className="text-zinc-600 mt-3">{viewProfile.bio}</p>}
                {isOwnProfile && <p className="text-sm text-zinc-400 mt-2">{viewProfile.email}</p>}
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 mb-6">
        <button
          className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'all'
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-700'
          }`}
          onClick={() => setActiveTab('all')}
        >
          ทั้งหมด
        </button>
        <button
          className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'photos'
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-700'
          }`}
          onClick={() => setActiveTab('photos')}
        >
          รูปภาพ
        </button>
      </div>

      {activeTab === 'all' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Friends List */}
          <div className="lg:col-span-1">
            <Card className="p-4">
              <h2 className="text-lg font-semibold mb-4 text-zinc-900">เพื่อน ({friends.length})</h2>
              {friendsLoading ? (
                <div className="py-4 flex justify-center">
                  <div className="w-5 h-5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : friends.length === 0 ? (
                <p className="text-zinc-400 text-sm text-center py-4">ยังไม่มีเพื่อน</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {friends.slice(0, 9).map((friend) => (
                    <div
                      key={friend.uid}
                      onClick={() => navigate(`/profile/${friend.uid}`)}
                      className="flex flex-col items-center text-center cursor-pointer group"
                    >
                      <Avatar src={friend.photoURL} name={friend.displayName} size="md" />
                      <p className="text-xs text-zinc-700 mt-2 line-clamp-1 group-hover:underline">
                        {friend.displayName}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Posts */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4 text-zinc-900">
              {isOwnProfile ? 'โพสต์ของฉัน' : `โพสต์ของ ${viewProfile.displayName}`} ({posts.length})
            </h2>
            {postsLoading ? (
              <PageLoader />
            ) : posts.length === 0 ? (
              <p className="text-zinc-400 text-center py-8">ยังไม่มีโพสต์</p>
            ) : (
              posts.map((post) => <PostCard key={post.id} post={post} />)
            )}
          </div>
        </div>
      ) : (
        /* Photos Tab */
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900">รูปภาพทั้งหมด ({photos.length})</h2>
          {postsLoading ? (
            <PageLoader />
          ) : photos.length === 0 ? (
            <p className="text-zinc-400 text-center py-16 bg-zinc-50 rounded-xl">ยังไม่มีรูปภาพ</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {photos.map((url, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedPhotoIndex(i)}
                  className="aspect-square bg-zinc-100 rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-all hover:scale-[1.02] group relative"
                >
                  <img src={url} alt="Post image" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image Preview Modal for Photo Tab */}
      {selectedPhotoIndex !== null && (
        <ImageViewerModal
          images={photos}
          currentIndex={selectedPhotoIndex}
          open={selectedPhotoIndex !== null}
          onClose={() => setSelectedPhotoIndex(null)}
          onIndexChange={(idx) => setSelectedPhotoIndex(idx)}
        />
      )}
    </AppLayout>
  )
}
