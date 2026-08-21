import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  collection,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { UserProfile } from '@/types'

function mapUserProfile(uid: string, data: Record<string, unknown>): UserProfile {
  return {
    uid,
    email: (data.email as string) || '',
    displayName: (data.displayName as string) || 'User',
    username: (data.username as string) || '',
    photoURL: (data.photoURL as string) || '',
    bio: (data.bio as string) || '',
    isOnline: (data.isOnline as boolean) ?? false,
    lastSeen: data.lastSeen ? (data.lastSeen as { toDate: () => Date }).toDate() : null,
    createdAt: data.createdAt ? (data.createdAt as { toDate: () => Date }).toDate() : null,
  }
}

export async function registerUser(
  email: string,
  password: string,
  displayName: string,
  username: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName })
  await setDoc(doc(db, 'users', cred.user.uid), {
    uid: cred.user.uid,
    email,
    displayName,
    username: username.toLowerCase(),
    photoURL: '',
    bio: '',
    isOnline: true,
    createdAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
  })
  return cred.user
}

export async function loginUser(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  await updateDoc(doc(db, 'users', cred.user.uid), {
    isOnline: true,
    lastSeen: serverTimestamp(),
  })
  return cred.user
}

export async function logoutUser(): Promise<void> {
  if (auth.currentUser) {
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      isOnline: false,
      lastSeen: serverTimestamp(),
    })
  }
  await signOut(auth)
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return mapUserProfile(uid, snap.data())
}

export function subscribeToUser(uid: string, callback: (user: UserProfile | null) => void) {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    if (!snap.exists()) {
      callback(null)
      return
    }
    callback(mapUserProfile(uid, snap.data()))
  })
}

export async function updateUserProfile(
  uid: string,
  data: Partial<Pick<UserProfile, 'displayName' | 'bio' | 'photoURL' | 'username'>>
): Promise<void> {
  const update: Record<string, unknown> = { ...data }
  if (data.username) update.username = data.username.toLowerCase()
  await updateDoc(doc(db, 'users', uid), update)
}

export async function searchUsersByUsername(
  queryStr: string,
  excludeUid: string
): Promise<UserProfile[]> {
  const q = query(
    collection(db, 'users'),
    where('username', '>=', queryStr.toLowerCase()),
    where('username', '<=', queryStr.toLowerCase() + '\uf8ff'),
    limit(10)
  )
  const snap = await getDocs(q)
  return snap.docs
    .filter((d) => d.id !== excludeUid)
    .map((d) => mapUserProfile(d.id, d.data()))
}

export async function getFriendshipStatus(
  userId: string,
  otherUserId: string
): Promise<'none' | 'pending_sent' | 'pending_received' | 'friends'> {
  const { getDocs: gd, query: q, collection: col, where: wh } = await import('firebase/firestore')

  const friendshipId = [userId, otherUserId].sort().join('_')
  const friendSnap = await getDoc(doc(db, 'friendships', friendshipId))
  if (friendSnap.exists()) return 'friends'

  const sentSnap = await gd(
    q(col(db, 'friendRequests'), wh('fromUserId', '==', userId), wh('toUserId', '==', otherUserId), wh('status', '==', 'pending'))
  )
  if (!sentSnap.empty) return 'pending_sent'

  const receivedSnap = await gd(
    q(col(db, 'friendRequests'), wh('fromUserId', '==', otherUserId), wh('toUserId', '==', userId), wh('status', '==', 'pending'))
  )
  if (!receivedSnap.empty) return 'pending_received'

  return 'none'
}

export { mapUserProfile }
