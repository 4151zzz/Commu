import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Conversation, Message } from '@/types'
import { getUserProfile } from './auth.service'
import { createNotification } from './notifications.service'

function mapConversation(id: string, data: Record<string, unknown>): Conversation {
  return {
    id,
    participants: (data.participants as string[]) || [],
    lastMessage: (data.lastMessage as string) || '',
    lastMessageAt: data.lastMessageAt ? (data.lastMessageAt as { toDate: () => Date }).toDate() : null,
    updatedAt: data.updatedAt ? (data.updatedAt as { toDate: () => Date }).toDate() : null,
  }
}

function mapMessage(id: string, data: Record<string, unknown>): Message {
  return {
    id,
    senderId: (data.senderId as string) || '',
    text: (data.text as string) || '',
    type: (data.type as Message['type']) || 'text',
    createdAt: data.createdAt ? (data.createdAt as { toDate: () => Date }).toDate() : null,
    readBy: (data.readBy as Record<string, Date>) || {},
  }
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
        const conv = mapConversation(d.id, d.data())
        const otherUserId = conv.participants.find((p) => p !== userId)
        if (otherUserId) {
          const otherUser = await getUserProfile(otherUserId)
          return { ...conv, otherUser: otherUser || undefined }
        }
        return conv
      })
    )
    callback(conversations)
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
    const messages = snap.docs.map((d) => mapMessage(d.id, d.data()))
    callback(messages)
  })
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
  receiverId?: string
): Promise<void> {
  await addDoc(
    collection(db, 'conversations', conversationId, 'messages'),
    {
      senderId,
      text,
      type: 'text',
      createdAt: serverTimestamp(),
      readBy: {},
    }
  )

  const convRef = doc(db, 'conversations', conversationId)
  await updateDoc(convRef, {
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  if (receiverId) {
    const sender = await getUserProfile(senderId)
    await createNotification({
      recipientId: receiverId,
      type: 'message',
      fromUserId: senderId,
      referenceId: conversationId,
      message: `${sender?.displayName || 'Someone'} ส่งข้อความถึงคุณ`,
    })
  }
}

export async function getOrCreateConversation(
  userId: string,
  otherUserId: string
): Promise<string> {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId)
  )

  const snap = await getDocs(q)
  const existing = snap.docs.find(
    (d) =>
      d.data().participants.includes(otherUserId) &&
      d.data().participants.length === 2
  )

  if (existing) {
    return existing.id
  }

  const newConv = await addDoc(collection(db, 'conversations'), {
    participants: [userId, otherUserId],
    lastMessage: '',
    lastMessageAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return newConv.id
}
