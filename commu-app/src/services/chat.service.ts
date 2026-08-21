import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  updateDoc,
  limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Conversation, Message } from '@/types'
import { getConversationId } from '@/lib/utils'
import { getUserProfile } from './auth.service'
import { createNotification } from './notifications.service'

function mapMessage(id: string, data: Record<string, unknown>): Message {
  return {
    id,
    senderId: data.senderId as string,
    text: data.text as string,
    type: (data.type as Message['type']) || 'text',
    createdAt: data.createdAt ? (data.createdAt as { toDate: () => Date }).toDate() : null,
    readBy: (data.readBy as Record<string, Date>) || {},
  }
}

export async function getOrCreateConversation(
  userId: string,
  otherUserId: string
): Promise<string> {
  const convId = getConversationId(userId, otherUserId)
  const convRef = doc(db, 'conversations', convId)
  const snap = await getDoc(convRef)

  if (!snap.exists()) {
    await setDoc(convRef, {
      participants: [userId, otherUserId],
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
  return convId
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
  recipientId: string,
  type: Message['type'] = 'text'
): Promise<void> {
  await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    senderId,
    text,
    type,
    createdAt: serverTimestamp(),
    readBy: { [senderId]: serverTimestamp() },
  })

  await updateDoc(doc(db, 'conversations', conversationId), {
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  const sender = await getUserProfile(senderId)
  await createNotification({
    recipientId,
    type: 'message',
    fromUserId: senderId,
    referenceId: conversationId,
    message: `${sender?.displayName || 'Someone'}: ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`,
  })
}

export function subscribeToMessages(
  conversationId: string,
  callback: (messages: Message[]) => void
) {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc')
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => mapMessage(d.id, d.data())))
  })
}

export function subscribeToConversations(
  userId: string,
  callback: (conversations: Conversation[]) => void
) {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc')
  )

  return onSnapshot(q, async (snap) => {
    const conversations = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data()
        const otherUid = (data.participants as string[]).find((p) => p !== userId) || ''
        const otherUser = otherUid ? await getUserProfile(otherUid) : null
        return {
          id: d.id,
          participants: data.participants as string[],
          lastMessage: (data.lastMessage as string) || '',
          lastMessageAt: data.lastMessageAt
            ? (data.lastMessageAt as { toDate: () => Date }).toDate()
            : null,
          updatedAt: data.updatedAt
            ? (data.updatedAt as { toDate: () => Date }).toDate()
            : null,
          otherUser: otherUser || undefined,
        }
      })
    )
    callback(conversations)
  })
}

export async function getRecentConversations(userId: string): Promise<Conversation[]> {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc'),
    limit(20)
  )
  const snap = await getDocs(q)
  return Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data()
      const otherUid = (data.participants as string[]).find((p) => p !== userId) || ''
      const otherUser = otherUid ? await getUserProfile(otherUid) : null
      return {
        id: d.id,
        participants: data.participants as string[],
        lastMessage: (data.lastMessage as string) || '',
        lastMessageAt: data.lastMessageAt
          ? (data.lastMessageAt as { toDate: () => Date }).toDate()
          : null,
        updatedAt: data.updatedAt
          ? (data.updatedAt as { toDate: () => Date }).toDate()
          : null,
        otherUser: otherUser || undefined,
      }
    })
  )
}
