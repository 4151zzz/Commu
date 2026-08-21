import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native'
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '@/contexts/AuthContext'
import { getUserPosts } from '@/services/posts.service'
import { getFriends } from '@/services/friends.service'
import { updateUserProfile, logoutUser } from '@/services/auth.service'
import type { Post } from '@/types'
import { getAvatarColor, formatTimeAgo } from '@/lib/utils'

function Avatar({ name, photoURL, size = 80 }: { name?: string; photoURL?: string; size?: number }) {
  const [error, setError] = useState(false)
  const initials = (name || 'U').charAt(0).toUpperCase()
  const bg = getAvatarColor(name || 'U')

  if (photoURL && !error) {
    return <Image source={{ uri: photoURL }} style={{ width: size, height: size, borderRadius: size / 2 }} onError={() => setError(true)} />
  }
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, styles.avatarFallback]}>
      <Text style={[styles.avatarInitials, { fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  )
}

export default function ProfileScreen() {
  const { user, profile } = useAuth()
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [friendsCount, setFriendsCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Edit Modal State
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editPhoto, setEditPhoto] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([getUserPosts(user.uid), getFriends(user.uid)])
      .then(([p, f]) => {
        setPosts(p)
        setFriendsCount(f.length)
      })
      .finally(() => setLoading(false))
  }, [user])

  const openEditModal = () => {
    setEditName(profile?.displayName || '')
    setEditUsername(profile?.username || '')
    setEditBio(profile?.bio || '')
    setEditPhoto(profile?.photoURL || '')
    setShowEdit(true)
  }

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    })
    if (!result.canceled && result.assets[0].base64) {
      setEditPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`)
    }
  }

  const handleSaveProfile = async () => {
    if (!user || !editName.trim() || !editUsername.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกชื่อและ Username ให้ครบ')
      return
    }
    setSaving(true)
    try {
      await updateUserProfile(user.uid, {
        displayName: editName.trim(),
        username: editUsername.trim().toLowerCase(),
        bio: editBio.trim(),
        photoURL: editPhoto,
      })
      setShowEdit(false)
    } catch (err) {
      Alert.alert('ข้อผิดพลาด', err instanceof Error ? err.message : 'อัปเดตไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    Alert.alert('ออกจากระบบ', 'คุณต้องการออกจากระบบใช่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ออกจากระบบ',
        style: 'destructive',
        onPress: async () => {
          await logoutUser()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    )
  }

  return (
    <>
      <ScrollView style={styles.container}>
        {/* Header Options */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>โปรไฟล์</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>ออกจากระบบ</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.profileHeader}>
          <Avatar name={profile?.displayName} photoURL={profile?.photoURL} size={96} />
          <Text style={styles.displayName}>{profile?.displayName}</Text>
          <Text style={styles.username}>@{profile?.username}</Text>
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          <TouchableOpacity style={styles.editBtn} onPress={openEditModal}>
            <Text style={styles.editBtnText}>แก้ไขโปรไฟล์</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{posts.length}</Text>
            <Text style={styles.statLabel}>โพสต์</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{friendsCount}</Text>
            <Text style={styles.statLabel}>เพื่อน</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>โพสต์ของคุณ</Text>
        </View>

        {posts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>ยังไม่มีโพสต์</Text>
          </View>
        ) : (
          <View style={styles.postsContainer}>
            {posts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                <View style={styles.postCardHeader}>
                  <Text style={styles.postTime}>{post.createdAt ? formatTimeAgo(post.createdAt) : ''}</Text>
                </View>

                {post.content ? (
                  <Text style={styles.postContent}>{post.content}</Text>
                ) : null}

                {post.images && post.images.length > 0 && (
                  <View style={[styles.imagesGrid, post.images.length > 1 && styles.imagesGrid2col]}>
                    {post.images.slice(0, 4).map((uri, i) => (
                      <Image
                        key={i}
                        source={{ uri }}
                        style={[
                          styles.postImage,
                          post.images.length === 1 && styles.postImageFull,
                        ]}
                        resizeMode="cover"
                      />
                    ))}
                  </View>
                )}
                
                <View style={styles.postStats}>
                  <Text style={styles.stat}>❤️ {post.likeCount}</Text>
                  <Text style={styles.stat}>💬 {post.commentCount}</Text>
                  <Text style={styles.stat}>🔄 {post.repostCount}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEdit} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>แก้ไขโปรไฟล์</Text>
            <TouchableOpacity onPress={() => setShowEdit(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.editPhotoContainer}>
              <Avatar name={editName} photoURL={editPhoto} size={100} />
              <TouchableOpacity style={styles.changePhotoBtn} onPress={handlePickImage}>
                <Text style={styles.changePhotoText}>เปลี่ยนรูปโปรไฟล์</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>ชื่อที่แสดง</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="ชื่อของคุณ"
                placeholderTextColor="#52525b"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                value={editUsername}
                onChangeText={(t) => setEditUsername(t.toLowerCase())}
                placeholder="username"
                placeholderTextColor="#52525b"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>ประวัติย่อ</Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="บอกเล่าเรื่องราวของคุณสักหน่อย..."
                placeholderTextColor="#52525b"
                multiline
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.buttonDisabled]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>บันทึก</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' },
  
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff' },
  logoutBtn: { backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  logoutText: { color: '#f87171', fontSize: 12, fontWeight: '600' },

  // Avatar
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '700' },

  profileHeader: { alignItems: 'center', paddingVertical: 20 },
  displayName: { fontSize: 22, fontWeight: '700', color: '#fff', marginTop: 12 },
  username: { fontSize: 15, color: '#71717a', marginTop: 4 },
  bio: { fontSize: 14, color: '#d4d4d8', marginTop: 12, paddingHorizontal: 32, textAlign: 'center', lineHeight: 20 },
  
  editBtn: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  editBtnText: { color: '#e4e4e7', fontSize: 13, fontWeight: '600' },

  statsContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 16, borderTopColor: 'rgba(255,255,255,0.06)', borderTopWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', borderBottomWidth: 1, gap: 40 },
  statBox: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: '700', color: '#fff' },
  statLabel: { fontSize: 13, color: '#71717a', marginTop: 4 },

  section: { paddingHorizontal: 16, paddingVertical: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },

  postsContainer: { paddingHorizontal: 12, paddingBottom: 32 },
  postCard: { backgroundColor: '#14141e', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 10 },
  postCardHeader: { alignItems: 'flex-end' },
  postTime: { color: '#52525b', fontSize: 12 },
  postContent: { fontSize: 14, color: '#e4e4e7', lineHeight: 22 },
  imagesGrid: { gap: 4, marginTop: 4 },
  imagesGrid2col: { flexDirection: 'row', flexWrap: 'wrap' },
  postImage: { width: '49%', height: 140, borderRadius: 10 },
  postImageFull: { width: '100%', height: 220 },
  postStats: { flexDirection: 'row', gap: 16, borderTopColor: 'rgba(255,255,255,0.06)', borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
  stat: { fontSize: 13, color: '#71717a' },

  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: '#71717a', fontSize: 14 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#0a0a0f' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalClose: { color: '#71717a', fontSize: 18 },
  modalBody: { padding: 20 },
  editPhotoContainer: { alignItems: 'center', marginBottom: 24 },
  changePhotoBtn: { marginTop: 12, padding: 8 },
  changePhotoText: { color: '#7c3aed', fontSize: 14, fontWeight: '600' },
  
  field: { marginBottom: 16, gap: 8 },
  label: { color: '#a1a1aa', fontSize: 13, fontWeight: '500' },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 15 },
  
  saveBtn: { backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16, marginBottom: 40 },
  buttonDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
