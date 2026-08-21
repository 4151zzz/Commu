export interface UserProfile {
  uid: string
  email: string
  displayName: string
  username: string
  photoURL: string
  bio: string
  isOnline: boolean
  lastSeen: Date | null
  createdAt: Date | null
}

export interface FriendRequest {
  id: string
  fromUserId: string
  toUserId: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: Date | null
  fromUser?: UserProfile
}

export interface Conversation {
  id: string
  participants: string[]
  lastMessage: string
  lastMessageAt: Date | null
  updatedAt: Date | null
  otherUser?: UserProfile
}

export interface Message {
  id: string
  senderId: string
  text: string
  type: 'text' | 'image' | 'call'
  createdAt: Date | null
  readBy: Record<string, Date>
}

export interface Post {
  id: string
  authorId: string
  content: string
  images: string[]
  likeCount: number
  shareCount: number
  repostCount: number
  commentCount: number
  createdAt: Date | null
  author?: UserProfile
  likedByMe?: boolean
  repostedByMe?: boolean
  originalPostId?: string
  isRepost?: boolean
  repostCaption?: string
}

export interface Comment {
  id: string
  authorId: string
  text: string
  createdAt: Date | null
  author?: UserProfile
  replyToId?: string
  replyToAuthorName?: string
}

export interface AppNotification {
  id: string
  recipientId: string
  type: 'friend_request' | 'friend_accepted' | 'like' | 'comment' | 'message' | 'share' | 'repost' | 'call'
  fromUserId: string
  referenceId: string
  message: string
  read: boolean
  createdAt: Date | null
  fromUser?: UserProfile
}

export interface CallSession {
  id: string
  callerId: string
  calleeId: string
  type: 'audio' | 'video'
  status: 'ringing' | 'accepted' | 'ended' | 'rejected'
  offer?: RTCSessionDescriptionInit
  answer?: RTCSessionDescriptionInit
  callerCandidates?: RTCIceCandidateInit[]
  calleeCandidates?: RTCIceCandidateInit[]
  callerVideoOff?: boolean
  calleeVideoOff?: boolean
}
