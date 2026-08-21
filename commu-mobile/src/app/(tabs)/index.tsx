import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native'
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  subscribeToFeed,
  createPost,
  toggleLike,
  sharePost,
  repostPost,
  addComment,
  deletePost,
  subscribeToComments,
  getOriginalPost,
} from '@/services/posts.service'
import type { Post, Comment } from '@/types'
import { formatTimeAgo, getAvatarColor } from '@/lib/utils'
import * as ImagePicker from 'expo-image-picker'

// ─── Avatar Component ────────────────────────────────────────────────────────
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
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
        <Text style={[styles.avatarInitials, { fontSize: size * 0.42 }]}>{initials}</Text>
      </View>
      {online !== undefined && (
        <View style={[styles.onlineDot, { backgroundColor: online ? '#22c55e' : '#52525b' }]} />
      )}
    </View>
  )
}

// ─── PostCard Component ───────────────────────────────────────────────────────
function PostCard({ post, currentUserId, onDeleted }: { post: Post; currentUserId: string; onDeleted?: () => void }) {
  const [liked, setLiked] = useState(post.likedByMe || false)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [shareCount, setShareCount] = useState(post.shareCount)
  const [repostCount, setRepostCount] = useState(post.repostCount)
  const [showComments, setShowComments] = useState(false)
  const [showRepost, setShowRepost] = useState(false)
  const [repostCaption, setRepostCaption] = useState('')
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState<Comment[]>([])
  const [originalPost, setOriginalPost] = useState<Post | null>(null)
  const [repostLoading, setRepostLoading] = useState(false)

  const isOwner = currentUserId === post.authorId
  const displayPost = post.isRepost && originalPost ? originalPost : post

  useEffect(() => {
    if (post.isRepost && post.originalPostId) {
      getOriginalPost(post.originalPostId).then(setOriginalPost)
    }
  }, [post.isRepost, post.originalPostId])

  useEffect(() => {
    if (!showComments) return
    return subscribeToComments(post.id, setComments)
  }, [showComments, post.id])

  const handleLike = async () => {
    const newLiked = await toggleLike(post.id, currentUserId)
    setLiked(newLiked)
    setLikeCount((c) => (newLiked ? c + 1 : c - 1))
  }

  const handleShare = async () => {
    await sharePost(post.id, currentUserId)
    setShareCount((c) => c + 1)
  }

  const handleRepost = async () => {
    setRepostLoading(true)
    try {
      await repostPost(post.originalPostId || post.id, currentUserId, repostCaption)
      setRepostCount((c) => c + 1)
      setShowRepost(false)
      setRepostCaption('')
    } finally {
      setRepostLoading(false)
    }
  }

  const handleComment = async () => {
    if (!comment.trim()) return
    await addComment(post.id, currentUserId, comment.trim())
    setComment('')
  }

  const handleDelete = () => {
    Alert.alert('ลบโพสต์', 'คุณแน่ใจหรือไม่ว่าต้องการลบโพสต์นี้?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: async () => {
          await deletePost(post.id)
          onDeleted?.()
        },
      },
    ])
  }

  return (
    <>
      <View style={styles.postCard}>
        {post.isRepost && (
          <View style={styles.repostBadge}>
            <Text style={styles.repostBadgeText}>🔄 {post.author?.displayName} รีโพสต์</Text>
          </View>
        )}

        <View style={styles.postHeader}>
          <Avatar name={displayPost.author?.displayName} photoURL={displayPost.author?.photoURL} size={40} />
          <View style={styles.postAuthorInfo}>
            <Text style={styles.authorName}>{displayPost.author?.displayName}</Text>
            <Text style={styles.authorHandle}>
              @{displayPost.author?.username}
              {displayPost.createdAt ? ` · ${formatTimeAgo(displayPost.createdAt)}` : ''}
            </Text>
          </View>
          {isOwner && (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>🗑</Text>
            </TouchableOpacity>
          )}
        </View>

        {post.isRepost && post.repostCaption ? (
          <Text style={styles.repostCaption}>{post.repostCaption}</Text>
        ) : null}

        {displayPost.content ? (
          <Text style={styles.postContent}>{displayPost.content}</Text>
        ) : null}

        {displayPost.images && displayPost.images.length > 0 && (
          <View style={[styles.imagesGrid, displayPost.images.length > 1 && styles.imagesGrid2col]}>
            {displayPost.images.slice(0, 4).map((uri, i) => (
              <Image
                key={i}
                source={{ uri }}
                style={[
                  styles.postImage,
                  displayPost.images.length === 1 && styles.postImageFull,
                ]}
                resizeMode="cover"
              />
            ))}
          </View>
        )}

        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
            <Text style={[styles.actionIcon, liked && styles.actionLiked]}>
              {liked ? '❤️' : '🤍'} {likeCount > 0 ? likeCount : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowComments(true)}>
            <Text style={styles.actionIcon}>
              💬 {post.commentCount > 0 ? post.commentCount : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <Text style={styles.actionIcon}>
              📤 {shareCount > 0 ? shareCount : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowRepost(true)}>
            <Text style={styles.actionIcon}>
              🔄 {repostCount > 0 ? repostCount : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Comments Modal */}
      <Modal visible={showComments} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>ความคิดเห็น</Text>
            <TouchableOpacity onPress={() => setShowComments(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.commentsList}
            ListEmptyComponent={
              <Text style={styles.emptyText}>ยังไม่มีความคิดเห็น</Text>
            }
            renderItem={({ item: c }) => (
              <View style={styles.commentRow}>
                <Avatar name={c.author?.displayName} photoURL={c.author?.photoURL} size={32} />
                <View style={styles.commentBubble}>
                  <Text style={styles.commentAuthor}>{c.author?.displayName}</Text>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
              </View>
            )}
          />

          <View style={styles.commentInput}>
            <TextInput
              style={styles.commentField}
              value={comment}
              onChangeText={setComment}
              placeholder="เขียนความคิดเห็น..."
              placeholderTextColor="#52525b"
              multiline
            />
            <TouchableOpacity onPress={handleComment} style={styles.sendBtn}>
              <Text style={styles.sendBtnText}>ส่ง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Repost Modal */}
      <Modal visible={showRepost} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>รีโพสต์</Text>
            <TouchableOpacity onPress={() => setShowRepost(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <TextInput
              style={styles.repostField}
              value={repostCaption}
              onChangeText={setRepostCaption}
              placeholder="เพิ่มความคิดเห็น (ไม่บังคับ)..."
              placeholderTextColor="#52525b"
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity
              style={[styles.button, repostLoading && styles.buttonDisabled]}
              onPress={handleRepost}
              disabled={repostLoading}
            >
              {repostLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.buttonText}>🔄 รีโพสต์</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}

// ─── CreatePost Component ─────────────────────────────────────────────────────
function CreatePost({ authorId, photoURL, displayName, onCreated }: {
  authorId: string
  photoURL?: string
  displayName?: string
  onCreated?: () => void
}) {
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([]) // base64 strings
  const [loading, setLoading] = useState(false)

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.5,
      base64: true,
      selectionLimit: 4 - images.length,
    })
    if (!result.canceled) {
      const newBase64 = result.assets
        .filter((a) => a.base64)
        .map((a) => `data:image/jpeg;base64,${a.base64}`)
      setImages((prev) => [...prev, ...newBase64].slice(0, 4))
    }
  }

  const handlePost = async () => {
    if (!content.trim() && images.length === 0) return
    setLoading(true)
    try {
      await createPost(authorId, content.trim(), images)
      setContent('')
      setImages([])
      onCreated?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.createPost}>
      <View style={styles.createPostRow}>
        <Avatar name={displayName} photoURL={photoURL} size={40} />
        <TextInput
          style={styles.createInput}
          value={content}
          onChangeText={setContent}
          placeholder="มีอะไรอยากแชร์บ้าง?"
          placeholderTextColor="#52525b"
          multiline
        />
      </View>

      {images.length > 0 && (
        <ScrollView horizontal style={styles.previewRow} showsHorizontalScrollIndicator={false}>
          {images.map((uri, i) => (
            <TouchableOpacity key={i} onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}>
              <Image source={{ uri }} style={styles.previewImage} />
              <View style={styles.previewRemove}>
                <Text style={styles.previewRemoveText}>✕</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.createPostActions}>
        <TouchableOpacity onPress={pickImages} disabled={images.length >= 4} style={styles.mediaBtn}>
          <Text style={styles.mediaBtnText}>🖼 รูปภาพ {images.length > 0 ? `(${images.length}/4)` : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.postBtn, (!content.trim() && images.length === 0 || loading) && styles.buttonDisabled]}
          onPress={handlePost}
          disabled={(!content.trim() && images.length === 0) || loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.postBtnText}>โพสต์</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ─── Main Feed Screen ─────────────────────────────────────────────────────────
export default function FeedScreen() {
  const { user, profile } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToFeed(user.uid, (data) => {
      setPosts(data)
      setLoading(false)
      setRefreshing(false)
    })
    return unsub
  }, [user])

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.feedContent}
        ListHeaderComponent={
          <>
            <View style={styles.feedHeader}>
              <Text style={styles.feedTitle}>Commu</Text>
              <Text style={styles.feedSubtitle}>ดูโพสต์ล่าสุดจากชุมชน</Text>
            </View>
            {user && profile && (
              <CreatePost
                authorId={user.uid}
                photoURL={profile.photoURL}
                displayName={profile.displayName}
              />
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>ยังไม่มีโพสต์ เป็นคนแรกที่โพสต์เลย!</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => setRefreshing(true)}
            tintColor="#7c3aed"
          />
        }
        renderItem={({ item: post }) => (
          <PostCard
            post={post}
            currentUserId={user?.uid || ''}
          />
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  loadingContainer: { flex: 1, backgroundColor: '#0a0a0f', justifyContent: 'center', alignItems: 'center' },
  feedContent: { paddingBottom: 32 },
  feedHeader: { paddingHorizontal: 16, paddingTop: 16, marginBottom: 12 },
  feedTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 4 },
  feedSubtitle: { fontSize: 13, color: '#71717a' },

  // Avatar
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '700' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#0a0a0f' },

  // CreatePost
  createPost: {
    backgroundColor: '#14141e',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 14,
    gap: 12,
  },
  createPostRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  createInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  previewRow: { flexDirection: 'row' },
  previewImage: { width: 72, height: 72, borderRadius: 10, marginRight: 8 },
  previewRemove: {
    position: 'absolute',
    top: 2,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewRemoveText: { color: '#fff', fontSize: 10 },
  createPostActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mediaBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  mediaBtnText: { color: '#a1a1aa', fontSize: 13 },
  postBtn: { backgroundColor: '#7c3aed', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 18 },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // PostCard
  postCard: {
    backgroundColor: '#14141e',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 14,
    gap: 10,
  },
  repostBadge: { flexDirection: 'row', alignItems: 'center' },
  repostBadgeText: { color: '#71717a', fontSize: 12 },
  postHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  postAuthorInfo: { flex: 1 },
  authorName: { color: '#fff', fontWeight: '600', fontSize: 14 },
  authorHandle: { color: '#71717a', fontSize: 12, marginTop: 2 },
  deleteBtn: { padding: 6 },
  deleteBtnText: { fontSize: 16 },
  repostCaption: { color: '#e4e4e7', fontSize: 14 },
  postContent: { color: '#e4e4e7', fontSize: 14, lineHeight: 20 },
  imagesGrid: { gap: 4 },
  imagesGrid2col: { flexDirection: 'row', flexWrap: 'wrap' },
  postImage: { width: '49%', height: 140, borderRadius: 10 },
  postImageFull: { width: '100%', height: 220 },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 10,
  },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 4 },
  actionIcon: { color: '#a1a1aa', fontSize: 14 },
  actionLiked: { color: '#f43f5e' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#0a0a0f' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalClose: { color: '#71717a', fontSize: 18 },
  modalBody: { padding: 16, gap: 12 },
  commentsList: { padding: 16, gap: 12 },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  commentBubble: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 10,
  },
  commentAuthor: { color: '#fff', fontWeight: '600', fontSize: 13, marginBottom: 4 },
  commentText: { color: '#d4d4d8', fontSize: 14 },
  commentInput: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  commentField: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: { backgroundColor: '#7c3aed', borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '700' },
  repostField: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 14,
    color: '#fff',
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 12,
  },

  // Shared
  button: { backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: '#71717a', fontSize: 14 },
})
