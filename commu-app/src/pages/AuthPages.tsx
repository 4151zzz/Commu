import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { registerUser, loginUser, loginWithGoogle } from '@/services/auth.service'
import logoImg from '@/assets/logo.png'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginUser(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-zinc-100 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-zinc-50 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-24 h-24 rounded-3xl bg-zinc-950 p-3 flex items-center justify-center mb-4 shadow-2xl border border-zinc-800">
            <img src={logoImg} alt="Commu Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">
            ยินดีต้อนรับสู่ COMMU
          </h1>
          <p className="text-zinc-500 mt-2 text-sm">เข้าสู่ระบบเพื่อเชื่อมต่อกับเพื่อนของคุณ</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl bg-white border border-zinc-200 p-8 space-y-5 shadow-lg"
        >
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          <Input
            id="email"
            label="อีเมล"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            id="password"
            label="รหัสผ่าน"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" loading={loading} className="w-full">
            <Mail className="w-4 h-4" />
            เข้าสู่ระบบด้วยอีเมล
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-zinc-400">หรือ</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={loginWithGoogle}
            className="w-full"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            เข้าสู่ระบบด้วย Google
          </Button>

          <p className="text-center text-zinc-500 text-sm">
            ยังไม่มีบัญชี?{' '}
            <Link to="/register" className="text-zinc-900 hover:underline font-semibold">
              สมัครสมาชิก
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export function RegisterPage() {
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username ใช้ได้เฉพาะ a-z, 0-9 และ _')
      return
    }
    setLoading(true)
    try {
      await registerUser(email, password, displayName, username)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สมัครสมาชิกไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-zinc-100 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-zinc-50 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-24 h-24 rounded-3xl bg-zinc-950 p-3 flex items-center justify-center mb-4 shadow-2xl border border-zinc-800">
            <img src={logoImg} alt="Commu Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">
            สร้างบัญชี COMMU
          </h1>
          <p className="text-zinc-500 mt-2 text-sm">เริ่มต้นประสบการณ์โซเชียลของคุณ</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl bg-white border border-zinc-200 p-8 space-y-4 shadow-lg"
        >
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          <Input
            id="displayName"
            label="ชื่อที่แสดง"
            placeholder="ชื่อของคุณ"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />

          <Input
            id="username"
            label="Username"
            placeholder="username_123"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <Input
            id="email"
            label="อีเมล"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            id="password"
            label="รหัสผ่าน"
            type="password"
            placeholder="อย่างน้อย 6 ตัวอักษร"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" loading={loading} className="w-full mt-2">
            <User className="w-4 h-4" />
            สมัครสมาชิก
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-zinc-400">หรือ</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={loginWithGoogle}
            className="w-full"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            สมัครด้วย Google
          </Button>

          <p className="text-center text-zinc-500 text-sm pt-2">
            มีบัญชีอยู่แล้ว?{' '}
            <Link to="/login" className="text-zinc-900 hover:underline font-semibold">
              เข้าสู่ระบบ
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
