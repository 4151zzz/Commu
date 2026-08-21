# Commu - Social & Chat Application

แอปพลิเคชันโซเชียลและแชทแบบ Real-time สร้างด้วย **React + TypeScript + Firebase**

## ฟีเจอร์

- **Login / สมัครสมาชิก** — Email & Password ผ่าน Firebase Auth
- **แชท Real-time** — ส่งข้อความแบบทันทีด้วย Firestore
- **ระบบเพื่อน** — ค้นหา, ส่งคำขอ, ยอมรับ/ปฏิเสธ
- **แจ้งเตือน** — Like, Comment, Share, Repost, Message, Friend Request, Call
- **โพสต์** — สร้างโพสต์, อัปโหลดรูป, Like, Comment, Share, Repost
- **โทร / วิดีโอคอล** — WebRTC P2P ผ่าน Firestore signaling
- **UI สวยงาม** — Dark theme, Glass morphism, Responsive

## เริ่มต้นใช้งาน

### 1. สร้าง Firebase Project

1. ไปที่ [Firebase Console](https://console.firebase.google.com)
2. สร้างโปรเจกต์ใหม่
3. เปิด **Authentication** → Sign-in method → เปิด **Email/Password**
4. สร้าง **Firestore Database** (Production mode)
5. เปิด **Storage**
6. ไปที่ Project Settings → Your apps → เพิ่ม Web app → คัดลอก config

### 2. ตั้งค่า Environment

```bash
cd commu-app
cp .env.example .env
```

แก้ไข `.env` ใส่ค่า Firebase config:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 3. Deploy Security Rules

```bash
npm install -g firebase-tools
firebase login
firebase init firestore storage
firebase deploy --only firestore:rules,firestore:indexes,storage
```

หรือ copy เนื้อหาจาก `firestore.rules` และ `storage.rules` ไปวางใน Firebase Console

### 4. รันแอป

```bash
npm install
npm run dev
```

เปิด http://localhost:5173

## ทดสอบ

1. สมัครสมาชิก 2 บัญชี (ใช้ 2 browser หรือ incognito)
2. ค้นหา username แล้วส่งคำขอเป็นเพื่อน
3. ยอมรับคำขอ → แชทกันได้
4. โพสต์, Like, Comment, Share, Repost
5. ทดสอบโทร/วิดีโอคอล (ต้อง HTTPS ใน production)

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- Firebase (Auth, Firestore, Storage)
- WebRTC (Audio/Video calls)
- Zustand (Call state)
- React Router v7

## โครงสร้าง

```
src/
├── components/   UI, Layout, Chat, Social, Call
├── pages/        Feed, Chat, Friends, Notifications, Profile
├── services/     Firebase business logic
├── contexts/     Auth context
├── stores/       Call store
└── lib/          Firebase config, utilities
```

## หมายเหตุ

- WebRTC ต้องใช้ HTTPS ใน production (localhost ใช้ได้)
- บาง network อาจต้อง TURN server สำหรับวิดีโอคอล
- Firebase Spark plan มี quota จำกัด — ใช้ Blaze สำหรับ production
