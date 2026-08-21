import { compressImage } from '@/lib/utils'

// If configured in .env, upload to our self-hosted server
// e.g. VITE_STORAGE_SERVER_URL=https://images.yourdomain.com or http://localhost:5000
const STORAGE_SERVER_URL = import.meta.env.VITE_STORAGE_SERVER_URL

/**
 * Upload single image to self-hosted server, or fallback to compressed Base64
 */
export async function uploadImage(file: File): Promise<string> {
  if (STORAGE_SERVER_URL) {
    try {
      const formData = new FormData()
      formData.append('image', file)

      const endpoint = `${STORAGE_SERVER_URL.replace(/\/$/, '')}/api/upload`
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`)
      }

      const data = await res.json()
      if (data.url) {
        return data.url
      }
    } catch (err) {
      console.warn('[StorageService] Self-hosted server upload failed, falling back to local compression:', err)
    }
  }

  // Fallback to client-side compressed base64
  return compressImage(file, 600, 0.4)
}

/**
 * Upload multiple images in batch
 */
export async function uploadMultipleImages(files: File[]): Promise<string[]> {
  if (files.length === 0) return []

  if (STORAGE_SERVER_URL) {
    try {
      const formData = new FormData()
      files.forEach((file) => formData.append('images', file))

      const endpoint = `${STORAGE_SERVER_URL.replace(/\/$/, '')}/api/upload-multiple`
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        if (data.urls && Array.isArray(data.urls)) {
          return data.urls
        }
      }
    } catch (err) {
      console.warn('[StorageService] Multiple upload failed, falling back to per-file compression:', err)
    }
  }

  // Fallback to sequential compressed base64
  return Promise.all(files.map((file) => compressImage(file, 600, 0.4)))
}

/**
 * Delete images from self-hosted server hard disk when post is deleted
 */
export async function deleteImagesFromStorage(imageUrls: string[]): Promise<void> {
  if (!imageUrls || imageUrls.length === 0 || !STORAGE_SERVER_URL) return

  try {
    // Only send deletion requests for URLs that belong to our storage server
    const serverImages = imageUrls.filter((url) => url.startsWith('http'))
    if (serverImages.length === 0) return

    const endpoint = `${STORAGE_SERVER_URL.replace(/\/$/, '')}/api/delete`
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls: serverImages }),
    })
  } catch (err) {
    console.warn('[StorageService] Failed to delete images from server:', err)
  }
}
