import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  increment,
  updateDoc,
  limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Post, Comment, UserProfile } from '@/types'
import { getUserProfile } from './auth.service'
import { createNotification } from './notifications.service'

// ---------- User profile cache (avoids repeated Firestore reads) ----------
const profileCache = new Map<string, UserProfile>()

async function getCachedProfile(uid: string): Promise<UserProfile | null> {
  if (profileCache.has(uid)) return profileCache.get(uid)!
  const profile = await getUserProfile(uid)
  if (profile) profileCache.set(uid, profile)
  return profile
}

/** Call this when a user updates their own profile so the cache stays fresh */
export function invalidateProfileCache(uid: string) {
  profileCache.delete(uid)
}

// ---------- Helpers ----------
function mapPost(id: string, data: Record<string, unknown>): Post {
  return {
    id,
    authorId: data.authorId as string,
    content: data.content as string,
    images: (data.images as string[]) || [],
    likeCount: (data.likeCount as number) || 0,
    shareCount: (data.shareCount as number) || 0,
    repostCount: (data.repostCount as number) || 0,
    commentCount: (data.commentCount as number) || 0,
    createdAt: data.createdAt ? (data.createdAt as { toDate: () => Date }).toDate() : null,
    originalPostId: data.originalPostId as string | undefined,
    isRepost: (data.isRepost as boolean) || false,
    repostCaption: data.repostCaption as string | undefined,
  }
}

import { uploadMultipleImages } from './storage.service'

// ---------- Create / Delete ----------

/**
 * Create a new post, uploading images if any.
 */
export async function createPost(
  authorId: string,
  content: string,
  images: File[] = []
): Promise<string> {
  const imageUrls = await uploadMultipleImages(images)

  const docRef = await addDoc(collection(db, 'posts'), {
    authorId,
    content,
    images: imageUrls,
    likeCount: 0,
    shareCount: 0,
    repostCount: 0,
    commentCount: 0,
    createdAt: serverTimestamp(),
    isRepost: false,
  })
  return docRef.id
}

export async function deletePost(postId: string): Promise<void> {
  await deleteDoc(doc(db, 'posts', postId))
}

// ---------- Reactions ----------

export async function toggleLike(postId: string, userId: string): Promise<boolean> {
  const likeRef = doc(db, 'posts', postId, 'likes', userId)
  const likeSnap = await getDoc(likeRef)
  const postRef = doc(db, 'posts', postId)

  if (likeSnap.exists()) {
    await deleteDoc(likeRef)
    await updateDoc(postRef, { likeCount: increment(-1) })
    return false
  }

  await setDoc(likeRef, { createdAt: serverTimestamp() })
  await updateDoc(postRef, { likeCount: increment(1) })

  const postSnap = await getDoc(postRef)
  const authorId = postSnap.data()?.authorId as string
  if (authorId && authorId !== userId) {
    const user = await getCachedProfile(userId)
    await createNotification({
      recipientId: authorId,
      type: 'like',
      fromUserId: userId,
      referenceId: postId,
      message: `${user?.displayName || 'Someone'} ถูกใจโพสต์ของคุณ`,
    })
  }
  return true
}

export async function sharePost(postId: string, userId: string): Promise<void> {
  const postRef = doc(db, 'posts', postId)
  await updateDoc(postRef, { shareCount: increment(1) })

  const postSnap = await getDoc(postRef)
  const authorId = postSnap.data()?.authorId as string
  if (authorId && authorId !== userId) {
    const user = await getCachedProfile(userId)
    await createNotification({
      recipientId: authorId,
      type: 'share',
      fromUserId: userId,
      referenceId: postId,
      message: `${user?.displayName || 'Someone'} แชร์โพสต์ของคุณ`,
    })
  }
}

export async function repostPost(
  originalPostId: string,
  userId: string,
  caption: string = ''
): Promise<string> {
  const originalSnap = await getDoc(doc(db, 'posts', originalPostId))
  if (!originalSnap.exists()) throw new Error('Post not found')

  const original = originalSnap.data()
  const docRef = await addDoc(collection(db, 'posts'), {
    authorId: userId,
    content: caption,
    images: [],
    likeCount: 0,
    shareCount: 0,
    repostCount: 0,
    commentCount: 0,
    createdAt: serverTimestamp(),
    isRepost: true,
    originalPostId,
    repostCaption: caption,
  })

  await updateDoc(doc(db, 'posts', originalPostId), { repostCount: increment(1) })

  const authorId = original.authorId as string
  if (authorId !== userId) {
    const user = await getCachedProfile(userId)
    await createNotification({
      recipientId: authorId,
      type: 'repost',
      fromUserId: userId,
      referenceId: originalPostId,
      message: `${user?.displayName || 'Someone'} รีโพสต์โพสต์ของคุณ`,
    })
  }
  return docRef.id
}

// ---------- Comments ----------

export async function addComment(
  postId: string,
  authorId: string,
  text: string
): Promise<void> {
  await addDoc(collection(db, 'posts', postId, 'comments'), {
    authorId,
    text,
    createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) })

  const postSnap = await getDoc(doc(db, 'posts', postId))
  const postAuthorId = postSnap.data()?.authorId as string
  if (postAuthorId && postAuthorId !== authorId) {
    const user = await getCachedProfile(authorId)
    await createNotification({
      recipientId: postAuthorId,
      type: 'comment',
      fromUserId: authorId,
      referenceId: postId,
      message: `${user?.displayName || 'Someone'} แสดงความคิดเห็นในโพสต์ของคุณ`,
    })
  }
}

// ---------- Real-time subscriptions ----------

/**
 * Subscribe to the global feed (all posts, real-time).
 * Uses profile cache so repeated snapshot fires don't re-fetch the same users.
 */
export function subscribeToFeed(
  userId: string,
  callback: (posts: Post[]) => void
) {
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50))

  return onSnapshot(q, async (snap) => {
    // Collect unique author IDs and batch-prefetch missing profiles
    const uniqueAuthorIds = [...new Set(snap.docs.map((d) => d.data().authorId as string))]
    await Promise.all(uniqueAuthorIds.map((uid) => getCachedProfile(uid)))

    // Now build posts from cache — no extra Firestore round-trips per post
    const posts = await Promise.all(
      snap.docs.map(async (d) => {
        const post = mapPost(d.id, d.data())
        const author = await getCachedProfile(post.authorId)
        const likeSnap = await getDoc(doc(db, 'posts', d.id, 'likes', userId))
        return {
          ...post,
          author: author || undefined,
          likedByMe: likeSnap.exists(),
        }
      })
    )
    callback(posts)
  })
}

export function subscribeToComments(
  postId: string,
  callback: (comments: Comment[]) => void
) {
  const q = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'asc')
  )
  return onSnapshot(q, async (snap) => {
    const comments = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data()
        const author = await getCachedProfile(data.authorId as string)
        return {
          id: d.id,
          authorId: data.authorId as string,
          text: data.text as string,
          createdAt: data.createdAt
            ? (data.createdAt as { toDate: () => Date }).toDate()
            : null,
          author: author || undefined,
        }
      })
    )
    callback(comments)
  })
}

export async function getOriginalPost(postId: string): Promise<Post | null> {
  const snap = await getDoc(doc(db, 'posts', postId))
  if (!snap.exists()) return null
  const post = mapPost(snap.id, snap.data())
  const author = await getCachedProfile(post.authorId)
  return { ...post, author: author || undefined }
}

export async function getUserPosts(userId: string): Promise<Post[]> {
  const q = query(
    collection(db, 'posts'),
    where('authorId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(20)
  )
  const snap = await getDocs(q)
  return Promise.all(
    snap.docs.map(async (d) => {
      const post = mapPost(d.id, d.data())
      const author = await getCachedProfile(post.authorId)
      return { ...post, author: author || undefined }
    })
  )
}
