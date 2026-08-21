import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Conversation, Message } from '@/types'
import { getConversationId } from '@/lib/utils'
import { getUserProfile } from './auth.service'
import { createNotification } from './notifications.service'
import { sendPushNotification } from './push.service'

function mapMessage(id: string, data: Record<string, unknown>): Message {
  return {
    id,
    senderId: data.senderId as string,
    senderName: data.senderName as string | undefined,
    senderPhotoURL: data.senderPhotoURL as string | undefined,
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
      isGroup: false,
    })
  }
  return convId
}

/**
 * Create a new Group Chat
 */
export async function createGroupConversation(
  creatorId: string,
  participantIds: string[],
  groupName: string,
  groupPhotoURL?: string
): Promise<string> {
  const allParticipants = Array.from(new Set([creatorId, ...participantIds]))
  const convRef = await addDoc(collection(db, 'conversations'), {
    participants: allParticipants,
    isGroup: true,
    groupName: groupName.trim(),
    groupPhotoURL: groupPhotoURL || '',
    createdById: creatorId,
    adminIds: [creatorId],
    lastMessage: 'สร้างกลุ่มแชทเรียบร้อยแล้ว 🎉',
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // Add initial system message
  const creator = await getUserProfile(creatorId)
  await addDoc(collection(db, 'conversations', convRef.id, 'messages'), {
    senderId: creatorId,
    senderName: creator?.displayName || 'Admin',
    text: `${creator?.displayName || 'ใครบางคน'} ได้สร้างกลุ่ม "${groupName.trim()}"`,
    type: 'text',
    createdAt: serverTimestamp(),
    readBy: { [creatorId]: serverTimestamp() },
  })

  return convRef.id
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
  recipientId?: string,
  type: Message['type'] = 'text'
): Promise<void> {
  const sender = await getUserProfile(senderId)
  const senderName = sender?.displayName || 'เพื่อนของคุณ'
  const senderPhotoURL = sender?.photoURL || ''

  await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    senderId,
    senderName,
    senderPhotoURL,
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

  const messagePreview = text.slice(0, 50) + (text.length > 50 ? '...' : '')

  if (recipientId) {
    await createNotification({
      recipientId,
      type: 'message',
      fromUserId: senderId,
      referenceId: conversationId,
      message: `${senderName}: ${messagePreview}`,
    })

    // Trigger web push notification
    sendPushNotification(
      recipientId,
      `💬 ข้อความใหม่จาก ${senderName}`,
      messagePreview,
      `/chat`
    )
  }
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
        const isGroup = (data.isGroup as boolean) || false
        let otherUser: Conversation['otherUser']

        if (!isGroup) {
          const otherUid = (data.participants as string[]).find((p) => p !== userId) || ''
          if (otherUid) {
            otherUser = (await getUserProfile(otherUid)) || undefined
          }
        }

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
          isGroup,
          groupName: data.groupName as string | undefined,
          groupPhotoURL: data.groupPhotoURL as string | undefined,
          createdById: data.createdById as string | undefined,
          adminIds: data.adminIds as string[] | undefined,
          otherUser,
        }
      })
    )
    callback(conversations)
  })
}
