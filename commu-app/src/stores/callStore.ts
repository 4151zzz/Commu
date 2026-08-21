import { create } from 'zustand'
import type { CallSession } from '@/types'

interface CallState {
  activeCall: CallSession | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  isMuted: boolean
  isVideoOff: boolean
  setActiveCall: (call: CallSession | null) => void
  setLocalStream: (stream: MediaStream | null) => void
  setRemoteStream: (stream: MediaStream | null) => void
  toggleMute: () => void
  toggleVideo: () => void
  reset: () => void
}

export const useCallStore = create<CallState>((set, get) => ({
  activeCall: null,
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isVideoOff: false,
  setActiveCall: (call) => set({ activeCall: call }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  toggleMute: () => {
    const { localStream, isMuted } = get()
    localStream?.getAudioTracks().forEach((t) => (t.enabled = isMuted))
    set({ isMuted: !isMuted })
  },
  toggleVideo: () => {
    const { localStream, isVideoOff } = get()
    localStream?.getVideoTracks().forEach((t) => (t.enabled = isVideoOff))
    set({ isVideoOff: !isVideoOff })
  },
  reset: () => {
    const { localStream, remoteStream } = get()
    // Explicitly stop all local hardware tracks (release microphone & camera immediately)
    if (localStream) {
      localStream.getTracks().forEach((t) => {
        t.stop()
        t.enabled = false
      })
    }
    // Also stop any remote tracks
    if (remoteStream) {
      remoteStream.getTracks().forEach((t) => {
        t.stop()
        t.enabled = false
      })
    }
    set({
      activeCall: null,
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isVideoOff: false,
    })
  },
}))
