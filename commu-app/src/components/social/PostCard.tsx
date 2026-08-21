import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, Share2, Repeat2, Send, Trash2, UserPlus, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ImageViewerModal } from '@/components/ui/ImageViewerModal'
import { formatTimeAgo, cn } from '@/lib/utils'
import type { Post } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import {
  toggleLike,
  sharePost,
  repostPost,
  addComment,
  deletePost,
  subscribeToComments,
  getOriginalPost,
} from '@/services/posts.service'
import { getFriendshipStatus, sendFriendRequest } from '@/services/friends.service'

interface PostCardProps {
  post: Post
  onUpdate?: () => void
  onDeleted?: () => void
}

export function PostCard({ post, onUpdate, onDeleted }: PostCardProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [liked, setLiked] = useState(post.likedByMe || false)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [isLiking, setIsLiking] = useState(false) // prevents double-tap
  const [shareCount, setShareCount] = useState(post.shareCount)
  const [repostCount, setRepostCount] = useState(post.repostCount)
  const [showComments, setShowComments] = useState(false)
  const [showRepost, setShowRepost] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [repostCaption, setRepostCaption] = useState('')
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState<import('@/types').Comment[]>([])
  const [originalPost, setOriginalPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'friends'>('friends')
  const [sendingRequest, setSendingRequest] = useState(false)

  // Sync liked state when feed refreshes (e.g. after re-subscribe)
  useEffect(() => {
    setLiked(post.likedByMe || false)
    setLikeCount(post.likeCount)
  }, [post.likedByMe, post.likeCount])

  const displayPost = post.isRepost && originalPost ? originalPost : post
  const isOwner = user?.uid === displayPost.authorId

  useEffect(() => {
    if (post.isRepost && post.originalPostId) {
      getOriginalPost(post.originalPostId).then(setOriginalPost)
    }
  }, [post.isRepost, post.originalPostId])

  useEffect(() => {
    if (!showComments) return
    return subscribeToComments(post.id, setComments)
  }, [showComments, post.id])

  // Check friendship status for the author
  useEffect(() => {
    if (!user || isOwner || !displayPost.authorId) return
    getFriendshipStatus(user.uid, displayPost.authorId).then(setFriendshipStatus)
  }, [user, displayPost.authorId, isOwner])

  const handleAddFriend = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user || !displayPost.authorId) return
    setSendingRequest(true)
    try {
      await sendFriendRequest(user.uid, displayPost.authorId)
      setFriendshipStatus('pending_sent')
    } catch (err) {
      console.error(err)
    } finally {
      setSendingRequest(false)
    }
  }

  const handleLike = async () => {
    // Guard: prevent multiple in-flight requests (1 account = 1 like)
    if (!user || isLiking) return
    setIsLiking(true)
    // Optimistic UI update
    const optimisticLiked = !liked
    setLiked(optimisticLiked)
    setLikeCount((c) => (optimisticLiked ? c + 1 : c - 1))
    try {
      const serverLiked = await toggleLike(post.id, user.uid)
      // Reconcile with server result
      setLiked(serverLiked)
      setLikeCount((c) => {
        // Adjust if server result differs from optimistic
        if (serverLiked !== optimisticLiked) {
          return serverLiked ? c + 1 : c - 1
        }
        return c
      })
    } catch {
      // Revert optimistic update on error
      setLiked(liked)
      setLikeCount((c) => (optimisticLiked ? c - 1 : c + 1))
    } finally {
      setIsLiking(false)
    }
  }

  const handleShare = async () => {
    if (!user) return
    await sharePost(post.id, user.uid)
    setShareCount((c) => c + 1)
    if (navigator.share) {
      navigator.share({ title: 'Commu Post', text: post.content, url: window.location.href }).catch(() => {})
    }
  }

  const handleRepost = async () => {
    if (!user) return
    setLoading(true)
    try {
      await repostPost(post.originalPostId || post.id, user.uid, repostCaption)
      setRepostCount((c) => c + 1)
      setShowRepost(false)
      setRepostCaption('')
      onUpdate?.()
    } finally {
      setLoading(false)
    }
  }

  const handleComment = async () => {
    if (!user || !comment.trim()) return
    await addComment(post.id, user.uid, comment.trim())
    setComment('')
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deletePost(post.id)
      setShowDeleteConfirm(false)
      onDeleted?.()
    } finally {
      setDeleting(false)
    }
  }

  const goToProfile = (authorId: string) => {
    navigate(`/profile/${authorId}`)
  }

  return (
    <>
      <Card className="p-5 mb-4">
        {post.isRepost && (
          <div
            onClick={() => post.authorId && goToProfile(post.authorId)}
            className="flex items-center gap-2 text-zinc-400 text-sm mb-3 cursor-pointer hover:text-zinc-600 transition-colors"
          >
            <Repeat2 className="w-4 h-4" />
            <span>{post.author?.displayName} รีโพสต์</span>
          </div>
        )}

        {post.isRepost && post.repostCaption && (
          <p className="text-zinc-900 mb-3">{post.repostCaption}</p>
        )}

        <div className="flex items-center justify-between gap-3 mb-4">
          {/* Author avatar & info with click to profile */}
          <div
            onClick={() => goToProfile(displayPost.authorId)}
            className="flex items-center gap-3 cursor-pointer group min-w-0"
          >
            <Avatar
              src={displayPost.author?.photoURL}
              name={displayPost.author?.displayName || 'User'}
              size="md"
            />
            <div className="min-w-0">
              <p className="font-semibold text-zinc-900 group-hover:underline truncate">
                {displayPost.author?.displayName}
              </p>
              <p className="text-sm text-zinc-400 truncate">
                @{displayPost.author?.username} · {formatTimeAgo(displayPost.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Add friend button if not owner and not friends */}
            {!isOwner && friendshipStatus === 'none' && (
              <button
                onClick={handleAddFriend}
                disabled={sendingRequest}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition-all active:scale-95 shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>เพิ่มเพื่อน</span>
              </button>
            )}

            {!isOwner && friendshipStatus === 'pending_sent' && (
              <span className="text-[11px] text-zinc-500 bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-full">
                ส่งคำขอแล้ว
              </span>
            )}

            {!isOwner && friendshipStatus === 'pending_received' && (
              <button
                onClick={() => navigate('/friends')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>คำขอใหม่</span>
              </button>
            )}

            {/* Delete button — only for post owner */}
            {isOwner && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-all"
                title="ลบโพสต์"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {displayPost.content && (
          <p className="text-[15px] text-zinc-800 leading-relaxed mb-4 whitespace-pre-wrap">
            {displayPost.content}
          </p>
        )}

        {displayPost.images.length > 0 && (
          <div
            className={cn(
              'grid gap-2 mb-4 rounded-2xl overflow-hidden',
              displayPost.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
            )}
          >
            {displayPost.images.map((url, i) => (
              <div
                key={i}
                onClick={() => setSelectedImageIndex(i)}
                className="relative overflow-hidden rounded-xl bg-zinc-100 cursor-pointer group"
              >
                <img
                  src={url}
                  alt="Post attachment"
                  className="w-full object-cover max-h-80 transition-transform duration-300 group-hover:scale-[1.02]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
          <button
            onClick={handleLike}
            disabled={isLiking}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-sm',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              liked
                ? 'text-red-500 bg-red-50'
                : 'text-zinc-400 hover:text-red-500 hover:bg-red-50'
            )}
          >
            <Heart className={cn('w-5 h-5', liked && 'fill-current', isLiking && 'animate-pulse')} />
            {likeCount > 0 && likeCount}
          </button>

          <button
            onClick={() => setShowComments(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all text-sm"
          >
            <MessageCircle className="w-5 h-5" />
            {post.commentCount > 0 && post.commentCount}
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all text-sm"
          >
            <Share2 className="w-5 h-5" />
            {shareCount > 0 && shareCount}
          </button>

          <button
            onClick={() => setShowRepost(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all text-sm"
          >
            <Repeat2 className="w-5 h-5" />
            {repostCount > 0 && repostCount}
          </button>
        </div>
      </Card>

      {/* Image Preview Modal */}
      {selectedImageIndex !== null && (
        <ImageViewerModal
          images={displayPost.images}
          currentIndex={selectedImageIndex}
          open={selectedImageIndex !== null}
          onClose={() => setSelectedImageIndex(null)}
          onIndexChange={(idx) => setSelectedImageIndex(idx)}
        />
      )}

      {/* Comments modal */}
      <Modal open={showComments} onClose={() => setShowComments(false)} title="ความคิดเห็น">
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {comments.length === 0 && (
            <p className="text-zinc-400 text-center py-4">ยังไม่มีความคิดเห็น</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div
                onClick={() => {
                  setShowComments(false)
                  goToProfile(c.authorId)
                }}
                className="cursor-pointer"
              >
                <Avatar name={c.author?.displayName || 'U'} src={c.author?.photoURL} size="sm" />
              </div>
              <div>
                <p
                  onClick={() => {
                    setShowComments(false)
                    goToProfile(c.authorId)
                  }}
                  className="text-sm font-medium text-zinc-900 cursor-pointer hover:underline"
                >
                  {c.author?.displayName}
                </p>
                <p className="text-sm text-zinc-600">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="เขียนความคิดเห็น..."
            className="flex-1 px-4 py-2 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
            onKeyDown={(e) => e.key === 'Enter' && handleComment()}
          />
          <Button size="icon" onClick={handleComment}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </Modal>

      {/* Repost modal */}
      <Modal open={showRepost} onClose={() => setShowRepost(false)} title="รีโพสต์">
        <textarea
          value={repostCaption}
          onChange={(e) => setRepostCaption(e.target.value)}
          placeholder="เพิ่มความคิดเห็น (ไม่บังคับ)..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-900 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900/20 mb-4"
        />
        <Button onClick={handleRepost} loading={loading} className="w-full">
          <Repeat2 className="w-4 h-4" />
          รีโพสต์
        </Button>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="ลบโพสต์">
        <p className="text-zinc-500 mb-6">คุณแน่ใจหรือไม่ว่าต้องการลบโพสต์นี้? ไม่สามารถกู้คืนได้</p>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => setShowDeleteConfirm(false)}
          >
            ยกเลิก
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={deleting}
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4" />
            ลบโพสต์
          </Button>
        </div>
      </Modal>
    </>
  )
}
