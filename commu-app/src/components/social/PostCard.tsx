import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Heart,
  MessageCircle,
  Share2,
  Repeat2,
  Send,
  Trash2,
  UserPlus,
  Check,
  Reply,
  Smile,
  X,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ImageViewerModal } from '@/components/ui/ImageViewerModal'
import { formatTimeAgo, cn } from '@/lib/utils'
import type { Post, Comment as CommentType } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import {
  toggleLike,
  sharePost,
  repostPost,
  addComment,
  deleteComment,
  deletePost,
  subscribeToComments,
  getOriginalPost,
} from '@/services/posts.service'
import { getFriendshipStatus, sendFriendRequest } from '@/services/friends.service'

const POPULAR_EMOJIS = ['❤️', '😂', '🔥', '👍', '😍', '🥺', '👏', '🥳', '🎉', '💯', '✨', '🙏', '🤣', '😭', '🚀', '😎']

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
  const [comments, setComments] = useState<CommentType[]>([])
  const [originalPost, setOriginalPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'friends'>('friends')
  const [sendingRequest, setSendingRequest] = useState(false)

  // Reply state
  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string } | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const commentInputRef = useRef<HTMLInputElement>(null)

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
    if (!user || isLiking) return
    setIsLiking(true)
    const optimisticLiked = !liked
    setLiked(optimisticLiked)
    setLikeCount((c) => (optimisticLiked ? c + 1 : c - 1))
    try {
      const serverLiked = await toggleLike(post.id, user.uid)
      setLiked(serverLiked)
      setLikeCount((c) => {
        if (serverLiked !== optimisticLiked) {
          return serverLiked ? c + 1 : c - 1
        }
        return c
      })
    } catch {
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
    const textToSend = comment.trim()
    const currentReply = replyingTo
    setComment('')
    setReplyingTo(null)
    setShowEmojiPicker(false)

    await addComment(
      post.id,
      user.uid,
      textToSend,
      currentReply?.id,
      currentReply?.authorName
    )
  }

  const handleStartReply = (c: CommentType) => {
    setReplyingTo({
      id: c.id,
      authorName: c.author?.displayName || 'User',
    })
    setTimeout(() => {
      commentInputRef.current?.focus()
    }, 100)
  }

  const handleDeleteComment = async (commentId: string) => {
    setDeletingCommentId(commentId)
    try {
      await deleteComment(post.id, commentId)
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingCommentId(null)
    }
  }

  const handleInsertEmoji = (emoji: string) => {
    setComment((prev) => prev + emoji)
    commentInputRef.current?.focus()
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
      <Card className="p-4 mb-3 overflow-hidden">
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

        <div className="flex items-center justify-between gap-2 mb-3">
          {/* Author avatar & info with click to profile */}
          <div
            onClick={() => goToProfile(displayPost.authorId)}
            className="flex items-center gap-2.5 cursor-pointer group min-w-0 flex-1"
          >
            <Avatar
              src={displayPost.author?.photoURL}
              name={displayPost.author?.displayName || 'User'}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-900 group-hover:underline truncate text-sm">
                {displayPost.author?.displayName}
              </p>
              <p className="text-xs text-zinc-400 truncate">
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
          <p className="text-sm text-zinc-800 leading-relaxed mb-3 whitespace-pre-wrap break-words overflow-hidden">
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
      <Modal open={showComments} onClose={() => setShowComments(false)} title={`ความคิดเห็น (${comments.length})`}>
        <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
          {comments.length === 0 && (
            <div className="text-center py-8">
              <p className="text-zinc-400 text-sm">ยังไม่มีความคิดเห็น</p>
              <p className="text-zinc-300 text-xs mt-1">เป็นคนแรกที่แสดงความคิดเห็น!</p>
            </div>
          )}
          {comments.map((c) => {
            const canDelete = user?.uid === c.authorId || isOwner
            const isDeleting = deletingCommentId === c.id

            return (
              <div key={c.id} className="flex gap-3 group">
                <div
                  onClick={() => {
                    setShowComments(false)
                    goToProfile(c.authorId)
                  }}
                  className="cursor-pointer flex-shrink-0"
                >
                  <Avatar name={c.author?.displayName || 'U'} src={c.author?.photoURL} size="sm" />
                </div>
                <div className="flex-1 min-w-0 bg-zinc-50 rounded-2xl p-3 border border-zinc-100/80">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <p
                        onClick={() => {
                          setShowComments(false)
                          goToProfile(c.authorId)
                        }}
                        className="text-xs font-semibold text-zinc-900 cursor-pointer hover:underline truncate"
                      >
                        {c.author?.displayName}
                      </p>
                      {c.createdAt && (
                        <span className="text-[10px] text-zinc-400 flex-shrink-0">
                          {formatTimeAgo(c.createdAt)}
                        </span>
                      )}
                    </div>

                    {/* Delete button (for comment author or post owner) */}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        disabled={isDeleting}
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="ลบความคิดเห็น"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Reply badge if replying to another user */}
                  {c.replyToAuthorName && (
                    <div className="flex items-center gap-1 text-[11px] text-zinc-500 bg-zinc-200/60 px-2 py-0.5 rounded-md mb-1.5 w-fit">
                      <Reply className="w-3 h-3 text-zinc-400 rotate-180" />
                      <span>ตอบกลับ <b>@{c.replyToAuthorName}</b></span>
                    </div>
                  )}

                  <p className="text-sm text-zinc-700 whitespace-pre-wrap break-words leading-relaxed">
                    {c.text}
                  </p>

                  {/* Reply button */}
                  <div className="flex items-center gap-3 mt-2 pt-1 border-t border-zinc-100">
                    <button
                      onClick={() => handleStartReply(c)}
                      className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1 transition-colors"
                    >
                      <Reply className="w-3 h-3" />
                      ตอบกลับ
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Reply Indicator Bar */}
        {replyingTo && (
          <div className="flex items-center justify-between px-3 py-1.5 mt-3 bg-zinc-100 border border-zinc-200 rounded-xl text-xs text-zinc-700 animate-in fade-in duration-150">
            <span className="flex items-center gap-1.5 truncate">
              <Reply className="w-3.5 h-3.5 text-zinc-500 rotate-180" />
              กำลังตอบกลับ <b className="text-zinc-900">@{replyingTo.authorName}</b>
            </span>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 rounded-lg transition-colors"
              title="ยกเลิกตอบกลับ"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Emoji Bar (Popup / Expandable) */}
        {showEmojiPicker && (
          <div className="p-2 mt-2 bg-zinc-50 border border-zinc-200 rounded-2xl grid grid-cols-8 gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
            {POPULAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleInsertEmoji(emoji)}
                className="w-8 h-8 flex items-center justify-center text-lg hover:scale-125 hover:bg-white rounded-lg transition-all"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Comment Input Box */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-zinc-100">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={cn(
              'p-2 rounded-xl transition-all',
              showEmojiPicker ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
            )}
            title="ใส่อิโมจิ"
          >
            <Smile className="w-5 h-5" />
          </button>

          <input
            ref={commentInputRef}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={replyingTo ? `ตอบกลับ @${replyingTo.authorName}...` : 'เขียนความคิดเห็น...'}
            className="flex-1 px-4 py-2 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
            onKeyDown={(e) => e.key === 'Enter' && handleComment()}
          />
          <Button size="icon" onClick={handleComment} disabled={!comment.trim()}>
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
