import { useState, useRef } from 'react'
import { ImagePlus, Send, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/contexts/AuthContext'
import { createPost } from '@/services/posts.service'

interface CreatePostProps {
  onCreated?: () => void
}

export function CreatePost({ onCreated }: CreatePostProps) {
  const { profile } = useAuth()
  const [content, setContent] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files)
    if (images.length + files.length > 4) {
      alert('เลือกรูปภาพได้สูงสุด 4 รูป')
      return
    }
    setImages((prev) => [...prev, ...files])
    
    const newPreviews = files.map(file => URL.createObjectURL(file))
    setImagePreviews((prev) => [...prev, ...newPreviews])
    
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = async () => {
    if (!content.trim() && images.length === 0) return
    if (!profile) return
    setLoading(true)
    try {
      await createPost(profile.uid, content.trim(), images)
      setContent('')
      setImages([])
      imagePreviews.forEach(url => URL.revokeObjectURL(url))
      setImagePreviews([])
      onCreated?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-5 mb-6">
      <div className="flex gap-4">
        <Avatar
          src={profile?.photoURL}
          name={profile?.displayName || 'User'}
          size="md"
        />
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="มีอะไรอยากแชร์บ้าง?"
            rows={3}
            className="w-full bg-transparent text-zinc-900 placeholder:text-zinc-400 resize-none focus:outline-none text-[15px] leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
            }}
          />

          {/* Image previews */}
          {imagePreviews.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {imagePreviews.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden group">
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full text-xs text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              multiple
              className="hidden"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= 4}
            >
              <ImagePlus className="w-4 h-4" />
              รูปภาพ
            </Button>
            <div className="flex items-center gap-2">
              {images.length > 0 && (
                <span className="text-xs text-zinc-400">{images.length}/4</span>
              )}
              <Button
                size="sm"
                onClick={handleSubmit}
                loading={loading}
                disabled={!content.trim() && images.length === 0}
              >
                <Send className="w-4 h-4" />
                โพสต์
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
