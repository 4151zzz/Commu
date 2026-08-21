import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { CallSession } from '@/types'
import { createNotification } from './notifications.service'
import { getUserProfile } from './auth.service'

// Multiple STUN servers for better NAT traversal + free TURN from open-relay
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Open Relay TURN — free public TURN server for real NAT traversal
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
]

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 10,
  })
}

export async function initiateCall(
  callerId: string,
  calleeId: string,
  type: 'audio' | 'video'
): Promise<string> {
  const caller = await getUserProfile(callerId)
  const docRef = await addDoc(collection(db, 'calls'), {
    callerId,
    calleeId,
    type,
    status: 'ringing',
    createdAt: serverTimestamp(),
    callerCandidates: [],
    calleeCandidates: [],
  })

  await createNotification({
    recipientId: calleeId,
    type: 'call',
    fromUserId: callerId,
    referenceId: docRef.id,
    message: `${caller?.displayName || 'Someone'} กำลังโทร${type === 'video' ? 'วิดีโอ' : ''}หาคุณ`,
  })

  return docRef.id
}

export function subscribeToCall(
  callId: string,
  callback: (call: CallSession | null) => void
) {
  return onSnapshot(doc(db, 'calls', callId), (snap) => {
    if (!snap.exists()) {
      callback(null)
      return
    }
    const data = snap.data()
    callback({
      id: snap.id,
      callerId: data.callerId as string,
      calleeId: data.calleeId as string,
      type: data.type as CallSession['type'],
      status: data.status as CallSession['status'],
      offer: data.offer as RTCSessionDescriptionInit | undefined,
      answer: data.answer as RTCSessionDescriptionInit | undefined,
      callerCandidates: (data.callerCandidates as RTCIceCandidateInit[]) || [],
      calleeCandidates: (data.calleeCandidates as RTCIceCandidateInit[]) || [],
    })
  })
}

export function subscribeToIncomingCalls(
  userId: string,
  callback: (calls: CallSession[]) => void
) {
  const q = query(
    collection(db, 'calls'),
    where('calleeId', '==', userId),
    where('status', '==', 'ringing')
  )

  return onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    const calls = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        callerId: data.callerId as string,
        calleeId: data.calleeId as string,
        type: data.type as CallSession['type'],
        status: data.status as CallSession['status'],
        offer: data.offer as RTCSessionDescriptionInit | undefined,
        answer: data.answer as RTCSessionDescriptionInit | undefined,
        callerCandidates: (data.callerCandidates as RTCIceCandidateInit[]) || [],
        calleeCandidates: (data.calleeCandidates as RTCIceCandidateInit[]) || [],
      }
    })
    callback(calls)
  })
}

export async function updateCallOffer(callId: string, offer: RTCSessionDescriptionInit) {
  await updateDoc(doc(db, 'calls', callId), { 
    offer: { type: offer.type, sdp: offer.sdp } 
  })
}

export async function updateCallAnswer(callId: string, answer: RTCSessionDescriptionInit) {
  await updateDoc(doc(db, 'calls', callId), { 
    answer: { type: answer.type, sdp: answer.sdp }, 
    status: 'accepted' 
  })
}

export async function addIceCandidate(
  callId: string,
  candidate: RTCIceCandidateInit,
  role: 'caller' | 'callee'
) {
  const field = role === 'caller' ? 'callerCandidates' : 'calleeCandidates'
  await updateDoc(doc(db, 'calls', callId), {
    [field]: arrayUnion(candidate),
  })
}

export async function endCall(callId: string, status: 'ended' | 'rejected' = 'ended') {
  await updateDoc(doc(db, 'calls', callId), { status })
}

export async function getUserMedia(type: 'audio' | 'video'): Promise<MediaStream> {
  // Request with explicit audio constraints for better quality
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: type === 'video' ? {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user',
    } : false,
  })
}
