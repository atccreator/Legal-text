import { useCallback, useRef, useState } from 'react'
import { useDocumentStore } from '../store/documentStore'

interface UploadZoneProps {
  onUpload?: (file: File) => void
  className?: string
}

export function UploadZone({ onUpload, className = '' }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addDocument, isUploading } = useDocumentStore()

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file')
      return
    }
    
    try {
      await addDocument(file)
      onUpload?.(file)
    } catch (error) {
      console.error('Failed to load PDF:', error)
      alert('Failed to load PDF file')
    }
  }, [addDocument, onUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const pdfFile = files.find(f => f.type === 'application/pdf')
    
    if (pdfFile) {
      handleFile(pdfFile)
    }
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }, [handleFile])

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center p-8
        border-2 border-dashed rounded-xl cursor-pointer
        transition-all duration-200 ease-out
        ${isDragOver 
          ? 'border-indigo-500 bg-indigo-50 scale-[1.02]' 
          : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
        }
        ${isUploading ? 'pointer-events-none opacity-60' : ''}
        ${className}
      `}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {isUploading ? (
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 mb-4 rounded-full border-4 border-indigo-200 border-t-indigo-500 animate-spin" />
          <p className="text-sm text-gray-600">Loading PDF...</p>
        </div>
      ) : (
        <>
          <div className={`
            w-16 h-16 mb-4 rounded-2xl flex items-center justify-center
            transition-colors duration-200
            ${isDragOver ? 'bg-indigo-100' : 'bg-gray-100'}
          `}>
            <svg 
              className={`w-8 h-8 transition-colors duration-200 ${isDragOver ? 'text-indigo-600' : 'text-gray-400'}`}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
              />
            </svg>
          </div>
          
          <p className="text-base font-medium text-gray-700 mb-1">
            {isDragOver ? 'Drop PDF here' : 'Upload PDF Document'}
          </p>
          <p className="text-sm text-gray-500">
            Drag & drop or click to browse
          </p>
          
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>PDF files only, max 100MB</span>
          </div>
        </>
      )}
    </div>
  )
}

// Compact upload button for toolbar
export function UploadButton({ className = '' }: { className?: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addDocument, isUploading } = useDocumentStore()

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file')
      return
    }
    
    try {
      await addDocument(file)
    } catch (error) {
      console.error('Failed to load PDF:', error)
    }
  }, [addDocument])

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
    e.target.value = ''
  }, [handleFile])

  return (
    <button
      onClick={handleClick}
      disabled={isUploading}
      className={`
        inline-flex items-center gap-2 px-4 py-2 
        bg-indigo-600 hover:bg-indigo-700 
        text-white text-sm font-medium rounded-lg
        transition-colors duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />
      {isUploading ? (
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )}
      <span>{isUploading ? 'Loading...' : 'Open PDF'}</span>
    </button>
  )
}
