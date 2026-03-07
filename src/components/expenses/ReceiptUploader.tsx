import { useState, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { ensureFolder, uploadFile } from '../../services/google/drive'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Toast'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

interface ReceiptUploaderProps {
  jobNumber?: string
  clientCompany?: string
  onUpload: (fileId: string, fileName: string) => void
  existingFileName?: string
  description?: string
  date?: string
}

function buildCustomFileName(description: string | undefined, date: string | undefined, originalName: string): string {
  const ext = originalName.includes('.') ? '.' + originalName.split('.').pop() : ''
  const uid = crypto.randomUUID().slice(0, 8)
  const sanitized = (description || '').replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '-') || 'receipt'
  const datePart = date || new Date().toISOString().split('T')[0]
  return `${sanitized}-${datePart}-${uid}${ext}`
}

export function ReceiptUploader({ jobNumber, clientCompany, onUpload, existingFileName, description, date }: ReceiptUploaderProps) {
  const { receiptsFolderId, getToken } = useAuth()
  const { showToast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState(existingFileName || '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !receiptsFolderId) return

    if (file.size > MAX_FILE_SIZE) {
      showToast('File too large. Maximum size is 10MB.')
      return
    }

    if (!file.type.startsWith('image/')) {
      showToast('Only image files are allowed.')
      return
    }

    setUploading(true)
    try {
      const token = await getToken()

      // Create subfolder if job context exists
      let folderId = receiptsFolderId
      if (jobNumber && clientCompany) {
        folderId = await ensureFolder(`${jobNumber} - ${clientCompany}`, receiptsFolderId, token)
      }

      const customName = buildCustomFileName(description, date, file.name)
      const fileId = await uploadFile(file, folderId, token, customName)
      setFileName(customName)
      onUpload(fileId, customName)
    } catch (err) {
      console.error('Upload failed:', err instanceof Error ? err.message : 'Unknown error')
      showToast('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Receipt</label>
      {fileName && (
        <p className="text-sm text-gray-500 mb-1">{fileName}</p>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <Button
        size="sm"
        variant="secondary"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? 'Uploading...' : fileName ? 'Replace Photo' : 'Take/Upload Photo'}
      </Button>
    </div>
  )
}
