import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
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

export async function loginWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider()
  const cred = await signInWithPopup(auth, provider)
  
  // Check if user document exists
  const userRef = doc(db, 'users', cred.user.uid)
  const userSnap = await getDoc(userRef)
  
  if (!userSnap.exists()) {
    // New user from Google
    await setDoc(userRef, {
      uid: cred.user.uid,
      email: cred.user.email || '',
      displayName: cred.user.displayName || 'Google User',
      username: (cred.user.email?.split('@')[0] || `user_${cred.user.uid.slice(0,5)}`).toLowerCase(),
      photoURL: cred.user.photoURL || '',
      bio: '',
      isOnline: true,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    })
  } else {
    // Existing user
    await updateDoc(userRef, {
      isOnline: true,
      lastSeen: serverTimestamp(),
    })
  }
  
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
  const { collection, getDocs, query, where, limit } = await import('firebase/firestore')
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

export { mapUserProfile }
