import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getUserProfile, subscribeToUser } from '@/services/auth.service'
import type { UserProfile } from '@/types'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        let p = await getUserProfile(firebaseUser.uid)
        if (!p) {
          const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
          const { db } = await import('@/lib/firebase')
          
          await setDoc(doc(db, 'users', firebaseUser.uid), {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'User',
            username: (firebaseUser.email?.split('@')[0] || `user_${firebaseUser.uid.slice(0,5)}`).toLowerCase(),
            photoURL: firebaseUser.photoURL || '',
            bio: '',
            isOnline: true,
            createdAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
          })
          p = await getUserProfile(firebaseUser.uid)
        }
        setProfile(p)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!user) return
    return subscribeToUser(user.uid, setProfile)
  }, [user])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
