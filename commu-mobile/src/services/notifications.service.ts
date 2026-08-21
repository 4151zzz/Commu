import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  limit,
  getDocs,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AppNotification } from '@/types'
import { getUserProfile } from './auth.service'

function mapNotification(id: string, data: Record<string, unknown>): AppNotification {
  return {
    id,
    recipientId: data.recipientId as string,
    type: data.type as AppNotification['type'],
    fromUserId: data.fromUserId as string,
    referenceId: data.referenceId as string,
    message: data.message as string,
    read: (data.read as boolean) ?? false,
    createdAt: data.createdAt ? (data.createdAt as { toDate: () => Date }).toDate() : null,
  }
}

export async function createNotification(data: {
  recipientId: string
  type: AppNotification['type']
  fromUserId: string
  referenceId: string
  message: string
}): Promise<void> {
  if (data.recipientId === data.fromUserId) return
  await addDoc(collection(db, 'notifications'), {
    ...data,
    read: false,
    createdAt: serverTimestamp(),
  })
}

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: AppNotification[]) => void
) {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  )

  return onSnapshot(q, async (snap) => {
    const notifications = await Promise.all(
      snap.docs.map(async (d) => {
        const notif = mapNotification(d.id, d.data())
        const fromUser = await getUserProfile(notif.fromUserId)
        return { ...notif, fromUser: fromUser || undefined }
      })
    )
    callback(notifications)
  })
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true })
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
    where('read', '==', false)
  )
  const snap = await getDocs(q)
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }))
  await batch.commit()
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await deleteDoc(doc(db, 'notifications', notificationId))
}

export async function cleanupOldNotifications(userId: string): Promise<void> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  const old = snap.docs.filter((d) => {
    const data = d.data()
    if (!data.createdAt) return false
    return data.createdAt.toDate() < sevenDaysAgo
  })
  const batch = writeBatch(db)
  old.forEach((d) => batch.delete(d.ref))
  if (old.length > 0) await batch.commit()
}

export function getUnreadCount(notifications: AppNotification[]): number {
  return notifications.filter((n) => !n.read).length
}
