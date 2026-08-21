import { useEffect, useState } from 'react'
import { CreatePost } from '@/components/social/CreatePost'
import { PostCard } from '@/components/social/PostCard'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeToFeed } from '@/services/posts.service'
import type { Post } from '@/types'
import { AppLayout } from '@/components/layout/AppLayout'

export function FeedPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToFeed(user.uid, (data) => {
      setPosts(data)
      setLoading(false)
    })
    return unsub
  }, [user])

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">ฟีด</h1>
        <p className="text-zinc-500 text-sm mt-1">ดูโพสต์ล่าสุดจากชุมชน</p>
      </div>

      <CreatePost />

      {loading ? (
        <PageLoader />
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-400">ยังไม่มีโพสต์ เป็นคนแรกที่โพสต์เลย!</p>
        </div>
      ) : (
        posts.map((post) => <PostCard key={post.id} post={post} />)
      )}
    </AppLayout>
  )
}
