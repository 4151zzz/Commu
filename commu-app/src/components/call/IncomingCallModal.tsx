import { Phone, PhoneOff, Video } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { CallSession } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { getUserProfile } from '@/services/auth.service'
import { Avatar } from '@/components/ui/Avatar'

interface IncomingCallModalProps {
  call: CallSession
  onAccept: () => void
  onReject: () => void
}

export function IncomingCallModal({ call, onAccept, onReject }: IncomingCallModalProps) {
  const { user } = useAuth()
  const [callerName, setCallerName] = useState('Someone')
  const [callerPhoto, setCallerPhoto] = useState<string | undefined>()

  useEffect(() => {
    getUserProfile(call.callerId).then((p) => {
      if (p) {
        setCallerName(p.displayName)
        setCallerPhoto(p.photoURL)
      }
    })
  }, [call.callerId])

  if (call.calleeId !== user?.uid) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white border border-zinc-200 p-8 text-center shadow-2xl animate-in">
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <Avatar name={callerName} src={callerPhoto} size="xl" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full" />
          </div>
        </div>

        <h2 className="text-xl font-bold mb-1 text-zinc-900">{callerName}</h2>
        <p className="text-zinc-500 mb-8">
          {call.type === 'video' ? 'วิดีโอคอลเข้า' : 'สายเรียกเข้า'}
        </p>

        <div className="flex items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="danger"
              size="icon"
              className="!rounded-full !w-16 !h-16"
              onClick={onReject}
            >
              <PhoneOff className="w-7 h-7" />
            </Button>
            <span className="text-xs text-zinc-500">ปฏิเสธ</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onAccept}
              className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-all active:scale-95 shadow-lg"
            >
              {call.type === 'video' ? (
                <Video className="w-7 h-7" />
              ) : (
                <Phone className="w-7 h-7" />
              )}
            </button>
            <span className="text-xs text-zinc-500">รับสาย</span>
          </div>
        </div>
      </div>
    </div>
  )
}
