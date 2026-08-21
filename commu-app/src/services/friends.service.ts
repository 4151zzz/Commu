import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot,
  orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { FriendRequest } from '@/types'
import { getUserProfile } from './auth.service'
import { createNotification } from './notifications.service'

function mapRequest(id: string, data: Record<string, unknown>): FriendRequest {
  return {
    id,
    fromUserId: data.fromUserId as string,
    toUserId: data.toUserId as string,
    status: data.status as FriendRequest['status'],
    createdAt: data.createdAt ? (data.createdAt as { toDate: () => Date }).toDate() : null,
  }
}

export async function sendFriendRequest(fromUserId: string, toUserId: string): Promise<void> {
  if (fromUserId === toUserId) throw new Error('Cannot add yourself')

  const sentSnap = await getDocs(
    query(
      collection(db, 'friendRequests'),
      where('fromUserId', '==', fromUserId),
      where('toUserId', '==', toUserId)
    )
  )
  const receivedSnap = await getDocs(
    query(
      collection(db, 'friendRequests'),
      where('fromUserId', '==', toUserId),
      where('toUserId', '==', fromUserId)
    )
  )

  for (const d of [...sentSnap.docs, ...receivedSnap.docs]) {
    if (d.data().status !== 'rejected') {
      throw new Error('Friend request already exists')
    }
  }

  const friends = await getFriendIds(fromUserId)
  if (friends.includes(toUserId)) throw new Error('Already friends')

  const fromUser = await getUserProfile(fromUserId)
  await addDoc(collection(db, 'friendRequests'), {
    fromUserId,
    toUserId,
    status: 'pending',
    createdAt: serverTimestamp(),
  })

  await createNotification({
    recipientId: toUserId,
    type: 'friend_request',
    fromUserId,
    referenceId: fromUserId,
    message: `${fromUser?.displayName || 'Someone'} ส่งคำขอเป็นเพื่อน`,
  })
}

export async function acceptFriendRequest(requestId: string, currentUserId: string): Promise<void> {
  const reqRef = doc(db, 'friendRequests', requestId)
  const reqSnap = await getDoc(reqRef)
  if (!reqSnap.exists()) throw new Error('Request not found')

  const data = reqSnap.data()
  if (data.toUserId !== currentUserId) throw new Error('Unauthorized')
  if (data.status !== 'pending') throw new Error('Request already handled')

  await updateDoc(reqRef, { status: 'accepted' })

  const friendshipId = [data.fromUserId, data.toUserId].sort().join('_')
  await setDoc(doc(db, 'friendships', friendshipId), {
    userIds: [data.fromUserId, data.toUserId],
    createdAt: serverTimestamp(),
  })

  const currentUser = await getUserProfile(currentUserId)
  await createNotification({
    recipientId: data.fromUserId,
    type: 'friend_accepted',
    fromUserId: currentUserId,
    referenceId: currentUserId,
    message: `${currentUser?.displayName || 'Someone'} ยอมรับคำขอเป็นเพื่อนแล้ว`,
  })
}

export async function rejectFriendRequest(requestId: string, currentUserId: string): Promise<void> {
  const reqRef = doc(db, 'friendRequests', requestId)
  const reqSnap = await getDoc(reqRef)
  if (!reqSnap.exists()) throw new Error('Request not found')
  if (reqSnap.data().toUserId !== currentUserId) throw new Error('Unauthorized')
  await updateDoc(reqRef, { status: 'rejected' })
}

export async function getFriendIds(userId: string): Promise<string[]> {
  const snap = await getDocs(
    query(collection(db, 'friendships'), where('userIds', 'array-contains', userId))
  )
  return snap.docs.flatMap((d) => {
    const ids = d.data().userIds as string[]
    return ids.filter((id) => id !== userId)
  })
}

export async function getFriends(userId: string): Promise<import('@/types').UserProfile[]> {
  const friendIds = await getFriendIds(userId)
  const profiles = await Promise.all(friendIds.map((id) => getUserProfile(id)))
  return profiles.filter((p): p is import('@/types').UserProfile => p !== null)
}

export function subscribeToFriendRequests(
  userId: string,
  callback: (requests: FriendRequest[]) => void
) {
  const q = query(
    collection(db, 'friendRequests'),
    where('toUserId', '==', userId),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(q, async (snap) => {
    const requests = await Promise.all(
      snap.docs.map(async (d) => {
        const req = mapRequest(d.id, d.data())
        const fromUser = await getUserProfile(req.fromUserId)
        return { ...req, fromUser: fromUser || undefined }
      })
    )
    callback(requests)
  })
}

export async function getFriendshipStatus(
  currentUserId: string,
  otherUserId: string
): Promise<'none' | 'pending_sent' | 'pending_received' | 'friends'> {
  const friends = await getFriendIds(currentUserId)
  if (friends.includes(otherUserId)) return 'friends'

  const sentSnap = await getDocs(
    query(
      collection(db, 'friendRequests'),
      where('fromUserId', '==', currentUserId),
      where('toUserId', '==', otherUserId),
      where('status', '==', 'pending')
    )
  )
  if (!sentSnap.empty) return 'pending_sent'

  const receivedSnap = await getDocs(
    query(
      collection(db, 'friendRequests'),
      where('fromUserId', '==', otherUserId),
      where('toUserId', '==', currentUserId),
      where('status', '==', 'pending')
    )
  )
  if (!receivedSnap.empty) return 'pending_received'
  return 'none'
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  const friendshipId = [userId, friendId].sort().join('_')
  await deleteDoc(doc(db, 'friendships', friendshipId))
}
