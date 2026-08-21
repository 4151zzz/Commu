import { PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, Volume1 } from 'lucide-react'
import { useCallStore } from '@/stores/callStore'
import { Avatar } from '@/components/ui/Avatar'
import type { CallSession, UserProfile } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useRef, useState, useCallback } from 'react'
import { getUserProfile } from '@/services/auth.service'

interface CallModalProps {
  call: CallSession
  onHangUp: () => void
  ringing?: boolean
}

function useCallTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!active) {
      setSeconds(0)
      return
    }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [active])
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function CallModal({ call, onHangUp, ringing }: CallModalProps) {
  const { profile } = useAuth()
  const { localStream, remoteStream, isMuted, isVideoOff, toggleMute, toggleVideo } =
    useCallStore()
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const [remoteUser, setRemoteUser] = useState<UserProfile | null>(null)
  
  // Speaker state: false = Normal/Earpiece volume (0.35), true = Loud Speakerphone (1.0)
  const [isSpeakerPhone, setIsSpeakerPhone] = useState(false)

  const isConnected = !ringing && call.status === 'accepted'
  const timer = useCallTimer(isConnected)

  useEffect(() => {
    const otherId = call.callerId === profile?.uid ? call.calleeId : call.callerId
    if (otherId) getUserProfile(otherId).then(setRemoteUser)
  }, [call.callerId, call.calleeId, profile?.uid])

  const isVideo = call.type === 'video'
  const isCaller = call.callerId === profile?.uid
  const remoteVideoOff = isCaller ? call.calleeVideoOff : call.callerVideoOff

  // ── Attach local stream to local video element ──
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  // ── Attach remote stream to video element (video call) ──
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && !remoteVideoOff) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream, remoteVideoOff])

  // ── CRITICAL: Remote Audio Stream Playback & Volume Control ──
  useEffect(() => {
    const audioEl = remoteAudioRef.current
    if (!audioEl || !remoteStream) return

    audioEl.srcObject = remoteStream
    audioEl.muted = false
    // Normal earpiece volume = 0.35, Loud speakerphone volume = 1.0
    audioEl.volume = isSpeakerPhone ? 1.0 : 0.35

    const playPromise = audioEl.play()
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('[WebRTC] Audio autoplay policy prevented initial play, awaiting user interaction:', err)
      })
    }
  }, [remoteStream, isSpeakerPhone])

  // Fallback: If user touches or clicks anywhere on call modal, ensure audio element plays
  const handleInteraction = () => {
    const audioEl = remoteAudioRef.current
    if (audioEl && audioEl.paused && remoteStream) {
      audioEl.play().catch(() => {})
    }
  }

  // ── Speaker toggle (Normal/Earpiece vs Loud Speakerphone) ──
  const toggleSpeaker = useCallback(() => {
    setIsSpeakerPhone((prev) => {
      const next = !prev
      if (remoteAudioRef.current) {
        remoteAudioRef.current.volume = next ? 1.0 : 0.35
      }
      return next
    })
  }, [])

  return (
    <div
      onClick={handleInteraction}
      className="fixed inset-0 z-50 bg-zinc-900 flex flex-col items-center justify-center select-none"
    >
      {/* 
        CRITICAL: Never use display: none on audio element for WebRTC!
        Chromium engines suspend audio pipelines on display:none elements.
        Using fixed position with opacity 0 guarantees continuous audio decoding.
      */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        className="fixed -top-96 -left-96 w-1 h-1 opacity-0 pointer-events-none"
      />

      {/* Remote video (video call, connected, video not off) */}
      {isVideo && remoteStream && !remoteVideoOff ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-zinc-950" />
      )}

      <div className="relative z-10 flex flex-col items-center gap-4 p-8 text-center w-full max-w-sm">

        {/* Avatar + name + status (shown when no remote video) */}
        {(!isVideo || !remoteStream || remoteVideoOff) && (
          <>
            <div className="relative">
              {ringing && (
                <>
                  <span className="absolute inset-0 rounded-full bg-white/10 animate-ping scale-125" />
                  <span
                    className="absolute inset-0 rounded-full bg-white/5 animate-ping scale-150"
                    style={{ animationDelay: '0.3s' }}
                  />
                </>
              )}
              <Avatar
                name={remoteUser?.displayName || 'User'}
                src={remoteUser?.photoURL}
                size="xl"
                className="relative shadow-2xl"
              />
            </div>

            <div>
              <p className="text-xl font-bold text-white mt-2">
                {remoteUser?.displayName || 'กำลังเชื่อมต่อ...'}
              </p>

              {ringing ? (
                <div className="flex items-center justify-center gap-1 mt-2">
                  <span className="text-zinc-400 text-sm">กำลังโทร</span>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
              ) : isConnected ? (
                <div className="mt-1 flex flex-col items-center gap-1">
                  <p className="text-white/80 text-lg font-mono tracking-widest">{timer}</p>
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full ${isSpeakerPhone ? 'bg-white/20 text-white font-medium' : 'bg-black/30 text-zinc-400'}`}>
                    {isSpeakerPhone ? '🔊 ลำโพงนอก (ดังสุด)' : '🔈 เสียงแนบหูปกติ'}
                  </span>
                </div>
              ) : (
                <p className="text-zinc-400 text-sm mt-1 animate-pulse">กำลังเชื่อมต่อสัญญาณ...</p>
              )}
            </div>
          </>
        )}

        {/* Timer overlay for video call */}
        {isVideo && remoteStream && !remoteVideoOff && isConnected && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
            <p className="text-white font-mono text-sm tracking-widest">{timer}</p>
            <span className="text-white/70 text-xs">
              {isSpeakerPhone ? '🔊' : '🔈'}
            </span>
          </div>
        )}

        {/* Local video PiP */}
        {isVideo && localStream && (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="fixed bottom-32 right-6 w-32 h-44 rounded-2xl object-cover border-2 border-white/20 shadow-xl"
          />
        )}

        {/* ── Control buttons ── */}
        <div className="fixed bottom-10 flex items-center justify-center gap-4 w-full px-4">

          {/* Mute microphone */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleMute()
              }}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-md ${
                isMuted
                  ? 'bg-white text-zinc-900'
                  : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-md'
              }`}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <span className="text-zinc-300 text-[11px]">{isMuted ? 'เปิดไมค์' : 'ปิดไมค์'}</span>
          </div>

          {/* Hang up button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onHangUp()
              }}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-red-500/40"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <span className="text-zinc-300 text-[11px]">วางสาย</span>
          </div>

          {/* Speaker toggle (Normal/Earpiece vs Speakerphone) */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleSpeaker()
              }}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-md ${
                isSpeakerPhone
                  ? 'bg-white text-zinc-900 shadow-white/20 shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-md'
              }`}
            >
              {isSpeakerPhone ? <Volume2 className="w-6 h-6" /> : <Volume1 className="w-6 h-6" />}
            </button>
            <span className="text-zinc-300 text-[11px]">
              {isSpeakerPhone ? 'ลำโพง (ดัง)' : 'เสียงปกติ'}
            </span>
          </div>

          {/* Video toggle (video call only) */}
          {isVideo && (
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleVideo()
                }}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-md ${
                  isVideoOff
                    ? 'bg-white text-zinc-900'
                    : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-md'
                }`}
              >
                {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
              </button>
              <span className="text-zinc-300 text-[11px]">{isVideoOff ? 'เปิดกล้อง' : 'ปิดกล้อง'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
