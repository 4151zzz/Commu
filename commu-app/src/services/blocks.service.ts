import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { BlockedUser } from '@/types'
import { getUserProfile } from './auth.service'

/**
 * Block a user
 */
export async function blockUser(userId: string, blockedUserId: string): Promise<void> {
  if (userId === blockedUserId) return

  const blockDocId = `${userId}_${blockedUserId}`
  await setDoc(doc(db, 'blocks', blockDocId), {
    userId,
    blockedUserId,
    createdAt: serverTimestamp(),
  })
}

/**
 * Unblock a user
 */
export async function unblockUser(userId: string, blockedUserId: string): Promise<void> {
  const blockDocId = `${userId}_${blockedUserId}`
  await deleteDoc(doc(db, 'blocks', blockDocId))
}

/**
 * Check if a specific user is blocked by current user
 */
export async function isUserBlocked(userId: string, targetUserId: string): Promise<boolean> {
  const blockDocId = `${userId}_${targetUserId}`
  const snap = await getDoc(doc(db, 'blocks', blockDocId))
  return snap.exists()
}

/**
 * Get all blocked user IDs for a user
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const q = query(collection(db, 'blocks'), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data().blockedUserId as string)
}

/**
 * Subscribe to the list of blocked users
 */
export function subscribeToBlockedUsers(
  userId: string,
  callback: (blockedList: BlockedUser[]) => void
) {
  const q = query(collection(db, 'blocks'), where('userId', '==', userId))

  return onSnapshot(q, async (snap) => {
    const list = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data()
        const blockedUserId = data.blockedUserId as string
        const profile = await getUserProfile(blockedUserId)
        return {
          id: d.id,
          userId: data.userId as string,
          blockedUserId,
          createdAt: data.createdAt ? (data.createdAt as { toDate: () => Date }).toDate() : null,
          blockedUser: profile || undefined,
        }
      })
    )
    callback(list)
  })
}
