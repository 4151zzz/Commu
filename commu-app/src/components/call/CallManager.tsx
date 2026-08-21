import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCallStore } from '@/stores/callStore'
import {
  subscribeToIncomingCalls,
  subscribeToCall,
  createPeerConnection,
  getUserMedia,
  updateCallOffer,
  updateCallAnswer,
  addIceCandidate,
  endCall,
  initiateCall,
} from '@/services/calls.service'
import { getOrCreateConversation, sendMessage } from '@/services/chat.service'
import type { CallSession } from '@/types'
import { CallModal } from './CallModal'
import { IncomingCallModal } from './IncomingCallModal'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export function CallManager() {
  const { user } = useAuth()
  const {
    activeCall,
    setActiveCall,
    setLocalStream,
    setRemoteStream,
    isVideoOff,
    reset,
  } = useCallStore()

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const [incomingCalls, setIncomingCalls] = useState<CallSession[]>([])
  const [isMediaReady, setIsMediaReady] = useState(false)
  const roleRef = useRef<'caller' | 'callee' | null>(null)

  // ── ICE candidate queue: holds candidates that arrived before remoteDescription was set ──
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([])
  const processedCandidates = useRef<Set<string>>(new Set())

  // ── Ref copy of activeCall so snapshot callbacks always see the latest without causing
  //    effect re-runs (prevents the subscription restart loop) ──
  const activeCallRef = useRef<CallSession | null>(null)
  useEffect(() => {
    activeCallRef.current = activeCall
  }, [activeCall])

  const cleanup = useCallback(() => {
    // 1. Stop all hardware tracks directly from ref (releases microphone / camera icon in browser)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
          track.enabled = false
        } catch {
          /* ignore */
        }
      })
      localStreamRef.current = null
    }

    // 2. Close peer connection senders and peer connection itself
    if (pcRef.current) {
      try {
        pcRef.current.getSenders().forEach((sender) => {
          if (sender.track) {
            try {
              sender.track.stop()
            } catch {
              /* ignore */
            }
          }
        })
        pcRef.current.close()
      } catch {
        /* ignore */
      }
      pcRef.current = null
    }

    roleRef.current = null
    pendingCandidates.current = []
    processedCandidates.current.clear()
    setIsMediaReady(false)
    reset()
  }, [reset])

  // ── Drain the pending ICE queue once remoteDescription is ready ──
  const drainPendingCandidates = useCallback(async () => {
    const pc = pcRef.current
    if (!pc || !pc.remoteDescription) return
    const queued = [...pendingCandidates.current]
    pendingCandidates.current = []
    for (const c of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c))
      } catch {
        /* ignore */
      }
    }
  }, [])

  const setupPeerConnection = useCallback(
    async (callId: string, role: 'caller' | 'callee', type: 'audio' | 'video') => {
      let stream: MediaStream
      try {
        stream = await getUserMedia(type)
      } catch (err) {
        console.error('Failed to get user media', err)
        alert('ไม่สามารถเข้าถึงไมโครโฟนหรือกล้องได้ กรุณาตรวจสอบการอนุญาตในเบราว์เซอร์')
        await endCall(callId, 'ended').catch(() => {})
        cleanup()
        throw err
      }

      localStreamRef.current = stream
      setLocalStream(stream)

      const pc = createPeerConnection()
      pcRef.current = pc
      roleRef.current = role

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addIceCandidate(callId, event.candidate.toJSON(), role)
        }
      }

      // Robust ontrack handling: supports both multi-stream and single track events
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0])
        } else if (event.track) {
          const newStream = new MediaStream([event.track])
          setRemoteStream(newStream)
        }
      }

      // If remote peer closes or fails, auto cleanup
      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', pc.connectionState)
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          // Give a small grace period for reconnection before cleanup if not already ended
          if (pc.connectionState === 'closed') {
            cleanup()
          }
        }
      }

      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE state:', pc.iceConnectionState)
      }

      // Add all tracks to PeerConnection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream)
      })

      setIsMediaReady(true)
      return pc
    },
    [setLocalStream, setRemoteStream, cleanup]
  )

  // ── Listen for incoming calls ──
  useEffect(() => {
    if (!user) return
    return subscribeToIncomingCalls(user.uid, setIncomingCalls)
  }, [user])

  // ── Main signaling effect ──
  const activeCallId = activeCall?.id
  useEffect(() => {
    if (!activeCallId || !user || !isMediaReady) return

    const unsub = subscribeToCall(activeCallId, async (call) => {
      if (!call) return

      // Call ended/rejected by other party → teardown immediately on this side too!
      if (call.status === 'ended' || call.status === 'rejected') {
        cleanup()
        return
      }

      const pc = pcRef.current
      if (!pc) return

      const isCaller = call.callerId === user.uid

      // ── Callee: receive offer, create answer ──
      if (!isCaller && call.offer && !pc.remoteDescription) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(call.offer))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          await updateCallAnswer(call.id, answer)
          // Drain any ICE candidates that arrived before offer was processed
          await drainPendingCandidates()
        } catch (err) {
          console.error('[WebRTC] Callee answer error:', err)
        }
      }

      // ── Caller: receive answer ──
      if (isCaller && call.answer && !pc.remoteDescription) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(call.answer))
          await drainPendingCandidates()
        } catch (err) {
          console.error('[WebRTC] Caller set answer error:', err)
        }
      }

      // ── Process remote ICE candidates ──
      const remoteCandidates = isCaller ? call.calleeCandidates : call.callerCandidates
      for (const candidate of remoteCandidates || []) {
        const key = JSON.stringify(candidate)
        if (processedCandidates.current.has(key)) continue
        processedCandidates.current.add(key)

        if (pc.remoteDescription) {
          // remoteDescription ready → add immediately
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
          } catch {
            /* ignore */
          }
        } else {
          // Queue until remoteDescription is ready
          pendingCandidates.current.push(candidate)
        }
      }

      // ── Update call status in store ──
      const statusPriority: Record<string, number> = {
        ringing: 0, accepted: 1, ended: 2, rejected: 2,
      }
      const current = activeCallRef.current
      if (
        current &&
        call.status !== current.status &&
        (statusPriority[call.status] ?? 0) >= (statusPriority[current.status] ?? 0)
      ) {
        setActiveCall({ ...current, status: call.status })
      }
    })

    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCallId, user?.uid, isMediaReady])

  // ── Sync video off state to Firestore ──
  useEffect(() => {
    if (activeCall && user) {
      const field = activeCall.callerId === user.uid ? 'callerVideoOff' : 'calleeVideoOff'
      updateDoc(doc(db, 'calls', activeCall.id), { [field]: isVideoOff }).catch(() => {})
    }
  }, [isVideoOff, activeCall?.id, user])

  const sendCallMessage = async (call: CallSession, endStatus: 'ended' | 'rejected') => {
    if (!user) return
    const isCaller = call.callerId === user.uid
    const otherId = isCaller ? call.calleeId : call.callerId

    let text = ''
    if (endStatus === 'rejected') {
      text = '📞 ปฏิเสธสาย'
    } else {
      if (call.status === 'ringing') {
        text = '📞 ยกเลิกการโทร'
      } else {
        text = call.type === 'video' ? '📹 วิดีโอคอลสิ้นสุด' : '📞 การโทรสิ้นสุด'
      }
    }

    try {
      const convId = await getOrCreateConversation(user.uid, otherId)
      await sendMessage(convId, user.uid, text, otherId, 'call')
    } catch (err) {
      console.error('Failed to send call message', err)
    }
  }

  const startOutgoingCall = async (calleeId: string, type: 'audio' | 'video') => {
    if (!user) return

    // Reset any previous call state
    cleanup()

    const callId = await initiateCall(user.uid, calleeId, type)

    const call: CallSession = {
      id: callId,
      callerId: user.uid,
      calleeId,
      type,
      status: 'ringing',
    }
    setActiveCall(call)

    try {
      const pc = await setupPeerConnection(callId, 'caller', type)
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: type === 'video',
      })
      await pc.setLocalDescription(offer)
      await updateCallOffer(callId, offer)
    } catch (err) {
      console.error('Call setup failed:', err)
      cleanup()
    }
  }

  const acceptIncomingCall = async (call: CallSession) => {
    // Set local status to accepted immediately so modal shows
    setActiveCall({ ...call, status: 'accepted' })
    setIncomingCalls((prev) => prev.filter((c) => c.id !== call.id))
    try {
      await setupPeerConnection(call.id, 'callee', call.type)
    } catch (err) {
      console.error('Accept call failed:', err)
      cleanup()
    }
  }

  const rejectIncomingCall = async (call: CallSession) => {
    setIncomingCalls((prev) => prev.filter((c) => c.id !== call.id))
    try {
      await endCall(call.id, 'rejected')
      await sendCallMessage(call, 'rejected')
    } catch (err) {
      console.error('Reject call failed:', err)
    }
  }

  const hangUp = async () => {
    const call = activeCallRef.current
    try {
      if (call) {
        // 1. Update Firestore status to 'ended' so other peer's listener triggers cleanup
        await endCall(call.id, 'ended')
        await sendCallMessage(call, 'ended')
      }
    } catch (err) {
      console.error('Hangup error:', err)
    } finally {
      // 2. Guaranteed local cleanup & track release
      cleanup()
    }
  }

  // Expose startOutgoingCall globally via window for ChatPage
  useEffect(() => {
    ;(window as unknown as { __startCall?: typeof startOutgoingCall }).__startCall =
      startOutgoingCall
    return () => {
      delete (window as unknown as { __startCall?: typeof startOutgoingCall }).__startCall
    }
  })

  return (
    <>
      {/* Active call screen (both ringing/accepted for caller, accepted for callee) */}
      {activeCall && activeCall.status === 'ringing' && activeCall.callerId === user?.uid && (
        <CallModal call={activeCall} onHangUp={hangUp} ringing />
      )}
      {activeCall && activeCall.status === 'accepted' && (
        <CallModal call={activeCall} onHangUp={hangUp} />
      )}

      {/* Incoming call modals */}
      {incomingCalls.map((call) => (
        <IncomingCallModal
          key={call.id}
          call={call}
          onAccept={() => acceptIncomingCall(call)}
          onReject={() => rejectIncomingCall(call)}
        />
      ))}
    </>
  )
}

export function startCall(calleeId: string, type: 'audio' | 'video') {
  const fn = (window as unknown as { __startCall?: (id: string, t: 'audio' | 'video') => void })
    .__startCall
  fn?.(calleeId, type)
}
