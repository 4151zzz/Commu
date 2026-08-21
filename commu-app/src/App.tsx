import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute, PublicRoute } from '@/components/layout/ProtectedRoute'
import { LoginPage, RegisterPage } from '@/pages/AuthPages'
import { FeedPage } from '@/pages/FeedPage'
import { ChatPage } from '@/pages/ChatPage'
import { FriendsPage } from '@/pages/FriendsPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { isFirebaseConfigured } from '@/lib/firebase'
import { Sparkles } from 'lucide-react'

function SetupPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-lg text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 mb-6">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 mb-4">ตั้งค่า Firebase</h1>
        <p className="text-zinc-500 mb-6">
          คัดลอกไฟล์ <code className="text-zinc-800 bg-zinc-100 px-1 rounded">.env.example</code> เป็น{' '}
          <code className="text-zinc-800 bg-zinc-100 px-1 rounded">.env</code> แล้วใส่ค่า Firebase config ของคุณ
        </p>
        <div className="text-left bg-zinc-100 rounded-xl p-4 text-sm text-zinc-600 font-mono border border-zinc-200">
          <p>cp .env.example .env</p>
          <p className="mt-2">npm run dev</p>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  if (!isFirebaseConfigured) {
    return <SetupPage />
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<FeedPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/:userId" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
