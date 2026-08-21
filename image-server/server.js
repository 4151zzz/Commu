const express = require('express')
const multer = require('multer')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const sharp = require('sharp')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 5000
const UPLOAD_DIR = path.join(__dirname, 'uploads')

// Ensure uploads folder exists on local disk
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// Enable CORS for all origins
app.use(cors())
app.use(express.json())

// Serve static images from local disk
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '30d', // Cache in browser for 30 days for fast loading
  immutable: true,
}))

// Multer memory storage (we process with Sharp before saving to disk)
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB max file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('รองรับเฉพาะไฟล์รูปภาพเท่านั้น (jpg, png, webp, gif)'), false)
    }
  },
})

// Helper to get base server URL
function getServerBaseUrl(req) {
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL.replace(/\/$/, '')
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol
  const host = req.headers['x-forwarded-host'] || req.get('host')
  return `${protocol}://${host}`
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Commu Image Server is running smoothly 🚀',
    uptime: process.uptime(),
    storageDir: UPLOAD_DIR,
  })
})

// Single image upload endpoint
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'กรุณาเลือกไฟล์รูปภาพ' })
    }

    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e6)}`
    const filename = `img_${uniqueSuffix}.webp`
    const filepath = path.join(UPLOAD_DIR, filename)

    // Convert and compress to WebP on local hard disk
    await sharp(req.file.buffer)
      .rotate() // Auto-orient based on EXIF
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filepath)

    const baseUrl = getServerBaseUrl(req)
    const fileUrl = `${baseUrl}/uploads/${filename}`

    console.log(`[Upload] Saved: ${filename} (${(req.file.size / 1024).toFixed(1)} KB -> disk)`)

    res.json({
      success: true,
      url: fileUrl,
      filename,
    })
  } catch (err) {
    console.error('[Upload Error]', err)
    res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ' })
  }
})

// Multiple images upload endpoint (up to 10 images)
app.post('/api/upload-multiple', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'กรุณาเลือกไฟล์รูปภาพอย่างน้อย 1 ไฟล์' })
    }

    const baseUrl = getServerBaseUrl(req)
    const uploadedUrls = []

    for (const file of req.files) {
      const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e6)}`
      const filename = `img_${uniqueSuffix}.webp`
      const filepath = path.join(UPLOAD_DIR, filename)

      await sharp(file.buffer)
        .rotate()
        .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(filepath)

      uploadedUrls.push(`${baseUrl}/uploads/${filename}`)
    }

    console.log(`[Upload] Saved ${uploadedUrls.length} images to local disk`)

    res.json({
      success: true,
      urls: uploadedUrls,
    })
  } catch (err) {
    console.error('[Multiple Upload Error]', err)
    res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ' })
  }
})

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`)
  console.log(`🚀 Commu Image Server is running on port ${PORT}`)
  console.log(`📂 Local Storage directory: ${UPLOAD_DIR}`)
  console.log(`🔗 Local URL: http://localhost:${PORT}`)
  console.log(`====================================================`)
})
