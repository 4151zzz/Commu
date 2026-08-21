import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Mail, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { registerUser, loginUser, loginWithGoogle } from '@/services/auth.service'

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
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 mb-4 shadow-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900">
            ยินดีต้อนรับกลับ
          </h1>
          <p className="text-zinc-500 mt-2">เข้าสู่ระบบ Commu ของคุณ</p>
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

          <Button type="submit" className="w-full" size="lg" loading={loading}>
            <Mail className="w-4 h-4" />
            เข้าสู่ระบบด้วย Email
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-zinc-400">หรือ</span>
            </div>
          </div>

          <Button 
            type="button" 
            variant="outline"
            className="w-full" 
            size="lg" 
            onClick={async () => {
              setError('')
              setLoading(true)
              try {
                await loginWithGoogle()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ')
              } finally {
                setLoading(false)
              }
            }}
            disabled={loading}
          >
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
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 mb-4 shadow-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900">
            สร้างบัญชีใหม่
          </h1>
          <p className="text-zinc-500 mt-2">เข้าร่วมชุมชน Commu</p>
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
            placeholder="John Doe"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />

          <Input
            id="username"
            label="Username"
            placeholder="johndoe"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
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
            placeholder="อย่างน้อย 6 ตัว"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" className="w-full" size="lg" loading={loading}>
            <User className="w-4 h-4" />
            สมัครสมาชิกด้วย Email
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-zinc-400">หรือ</span>
            </div>
          </div>

          <Button 
            type="button" 
            variant="outline"
            className="w-full" 
            size="lg" 
            onClick={async () => {
              setError('')
              setLoading(true)
              try {
                await loginWithGoogle()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ')
              } finally {
                setLoading(false)
              }
            }}
            disabled={loading}
          >
            สมัครสมาชิกด้วย Google
          </Button>

          <p className="text-center text-zinc-500 text-sm">
            มีบัญชีแล้ว?{' '}
            <Link to="/login" className="text-zinc-900 hover:underline font-semibold">
              เข้าสู่ระบบ
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
