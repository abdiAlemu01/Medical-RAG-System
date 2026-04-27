
"use client"
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Database, LucideLoader2, Upload, RefreshCcw, FileText, CheckCircle2, AlertCircle, Trash2, XCircle } from 'lucide-react'
import React, { useState, useRef, useEffect } from 'react'

interface FileWithError {
    file: File
    error?: string
}

const VectorDBPage = () => {
    const [isUploading, setIsUploading] = useState(false)
    const [isUploadingFiles, setIsUploadingFiles] = useState(false)
    const [isLoadingFiles, setIsLoadingFiles] = useState(false)
    const [fileList, setFileList] = useState<string[]>([])
    const [selectedFiles, setSelectedFiles] = useState<FileWithError[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)
    
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [statusMessage, setStatusMessage] = useState('')
    const [filename, setFilename] = useState('')
    const [progress, setProgress] = useState(0)

    useEffect(() => {
        loadFileList()
    }, [])

    const loadFileList = async () => {
        setIsLoadingFiles(true)
        try {
            const response = await fetch('/api/getfilelist', { method: 'GET' })
            if (!response.ok) throw new Error('Failed to fetch file list')
            const filenames = await response.json()
            setFileList(filenames)
            if (uploadStatus === 'error' && statusMessage.includes('validation')) {
                // Keep validation errors
            } else {
                setUploadStatus('idle')
            }
        } catch (error) {
            console.error('Error loading files:', error)
            setUploadStatus('error')
            setStatusMessage('Failed to load file list')
        } finally {
            setIsLoadingFiles(false)
        }
    }

    const deleteUploadedFile = async (filename: string) => {
        if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
            return
        }

        try {
            const response = await fetch('/api/deletefile', {
                method: 'DELETE',
                body: JSON.stringify({ filename })
            })

            if (!response.ok) throw new Error('Failed to delete file')

            const result = await response.json()
            
            if (result.success) {
                setUploadStatus('success')
                setStatusMessage(result.message)
                await loadFileList()
            } else {
                throw new Error(result.message || 'Delete failed')
            }
        } catch (error) {
            console.error('Delete error:', error)
            setUploadStatus('error')
            setStatusMessage(error instanceof Error ? error.message : 'Failed to delete file')
        }
    }

    const validateFile = (file: File): string | undefined => {
        const maxSize = 50 * 1024 * 1024 // 50MB
        const allowedTypes = ['.pdf', '.txt']
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()

        if (!allowedTypes.includes(fileExtension)) {
            return `Invalid file type. Only PDF and TXT files are allowed.`
        }

        if (file.size > maxSize) {
            return `File size exceeds 50MB limit (${formatFileSize(file.size)})`
        }

        if (file.size === 0) {
            return `File is empty`
        }

        return undefined
    }

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files
        if (!files || files.length === 0) return

        const filesWithValidation: FileWithError[] = Array.from(files).map(file => ({
            file,
            error: validateFile(file)
        }))

        setSelectedFiles(filesWithValidation)
        
        // Show warning if any files have errors
        const errorCount = filesWithValidation.filter(f => f.error).length
        if (errorCount > 0) {
            setUploadStatus('error')
            setStatusMessage(`${errorCount} file${errorCount > 1 ? 's have' : ' has'} validation errors. Please remove invalid files before uploading.`)
        } else {
            setUploadStatus('idle')
            setStatusMessage('')
        }
    }

    const removeSelectedFile = (index: number) => {
        setSelectedFiles(prev => {
            const newFiles = prev.filter((_, i) => i !== index)
            
            // Update status if all errors are removed
            if (newFiles.length === 0) {
                setUploadStatus('idle')
                setStatusMessage('')
            } else {
                const errorCount = newFiles.filter(f => f.error).length
                if (errorCount === 0) {
                    setUploadStatus('idle')
                    setStatusMessage('')
                } else {
                    setUploadStatus('error')
                    setStatusMessage(`${errorCount} file${errorCount > 1 ? 's have' : ' has'} validation errors. Please remove invalid files before uploading.`)
                }
            }
            
            return newFiles
        })
    }

    const uploadSelectedFiles = async () => {
        // Check for validation errors
        const filesWithErrors = selectedFiles.filter(f => f.error)
        if (filesWithErrors.length > 0) {
            setUploadStatus('error')
            setStatusMessage('Please remove all invalid files before uploading')
            return
        }

        if (selectedFiles.length === 0) {
            setUploadStatus('error')
            setStatusMessage('Please select files to upload')
            return
        }

        setIsUploadingFiles(true)
        setUploadStatus('idle')
        const formData = new FormData()
        
        selectedFiles.forEach(({ file }) => {
            formData.append('files', file)
        })

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            })
            
            if (!response.ok) throw new Error('Upload failed')
            
            const result = await response.json()
            
            if (result.success) {
                setUploadStatus('success')
                setStatusMessage(result.message)
                setSelectedFiles([])
                if (fileInputRef.current) fileInputRef.current.value = ''
                await loadFileList()
            } else {
                throw new Error(result.message || 'Upload failed')
            }
        } catch (error) {
            console.error('Upload error:', error)
            setUploadStatus('error')
            setStatusMessage(error instanceof Error ? error.message : 'Upload failed')
        } finally {
            setIsUploadingFiles(false)
        }
    }

    const handleUploadClick = () => {
        fileInputRef.current?.click()
    }

    const indexToVectorDB = async () => {
        if (fileList.length === 0) {
            setUploadStatus('error')
            setStatusMessage('No files available to index. Please upload files first.')
            return
        }

        setProgress(0)
        setFilename('')
        setIsUploading(true)
        setUploadStatus('idle')

        try {
            const response = await fetch('/api/updatedatabase', {
                method: 'POST',
                body: JSON.stringify({
                    indexname: process.env.NEXT_PUBLIC_PINECONE_INDEX_NAME || '',
                    namespace: process.env.NEXT_PUBLIC_PINECONE_NAMESPACE || ''
                })
            })
            
            if (!response.ok) throw new Error('Failed to start indexing')
            
            await processStreamedProgress(response)
            setUploadStatus('success')
            setStatusMessage('Files successfully indexed to vector database')
        } catch (error) {
            console.error('Indexing error:', error)
            setUploadStatus('error')
            setStatusMessage(error instanceof Error ? error.message : 'Indexing failed')
            setIsUploading(false)
        }
    }

    const processStreamedProgress = async (response: Response) => {
        const reader = response.body?.getReader()
        if (!reader) {
            setIsUploading(false)
            setUploadStatus('error')
            setStatusMessage('No response from server')
            return
        }

        try {
            while (true) {
                const { done, value } = await reader.read()
                if (done) {
                    setIsUploading(false)
                    break
                }

                try {
                    const data = new TextDecoder().decode(value)
                    const { filename, totalChunks, chunksUpserted } = JSON.parse(data)
                    const currentProgress = (chunksUpserted / totalChunks) * 100
                    setProgress(currentProgress)
                    setFilename(`${filename} [${chunksUpserted}/${totalChunks}]`)
                } catch (err) {
                    console.error('Malformed progress data:', err)
                }
            }
        } catch (error) {
            console.error('Error reading response:', error)
            setUploadStatus('error')
            setStatusMessage('Error reading upload progress')
            setIsUploading(false)
        } finally {
            reader.releaseLock()
        }
    }

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
    }

    return (
        <div className='min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'>
            <div className='max-w-6xl mx-auto p-4 md:p-8 space-y-6'>
                {/* Header */}
                <div className='text-center space-y-2 py-6'>
                    <div className='flex items-center justify-center gap-3 mb-4'>
                        <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/50'>
                            <Database className='h-6 w-6 text-white' />
                        </div>
                    </div>
                    <h1 className='text-3xl md:text-4xl font-bold text-white'>Knowledge Base Manager</h1>
                    <p className='text-slate-400'>Upload documents and index them to your vector database</p>
                </div>

                {/* Status Messages */}
                {uploadStatus !== 'idle' && (
                    <div className={`rounded-xl border-2 p-4 ${uploadStatus === 'success' ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                        <div className='flex items-center gap-3'>
                            {uploadStatus === 'success' ? (
                                <CheckCircle2 className='h-5 w-5 text-green-400' />
                            ) : (
                                <AlertCircle className='h-5 w-5 text-red-400' />
                            )}
                            <p className={`text-sm font-medium ${uploadStatus === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                                {statusMessage}
                            </p>
                        </div>
                    </div>
                )}

                <div className='grid md:grid-cols-2 gap-6'>
                    {/* Upload Section */}
                    <div className='rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl'>
                        <div className='border-b border-white/10 p-6'>
                            <div className='flex items-center gap-2 mb-2'>
                                <Upload className='h-5 w-5 text-cyan-400' />
                                <h2 className='text-xl font-bold text-white'>Upload Documents</h2>
                            </div>
                            <p className='text-sm text-slate-400'>Select PDF or TXT files from your device</p>
                        </div>
                        <div className='p-6 space-y-4'>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".pdf,.txt"
                                onChange={handleFileSelect}
                                className='hidden'
                            />
                            
                            <button 
                                onClick={handleUploadClick} 
                                className='w-full h-32 rounded-xl border-2 border-dashed border-white/20 hover:border-cyan-500/50 bg-white/5 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
                                disabled={isUploadingFiles || isUploading}
                            >
                                <div className='flex flex-col items-center gap-3'>
                                    <Upload className='h-10 w-10 text-cyan-400' />
                                    <span className='font-semibold text-white'>Choose Files</span>
                                    <span className='text-xs text-slate-400'>PDF, TXT (Max 50MB)</span>
                                </div>
                            </button>

                            {/* Selected Files Preview */}
                            {selectedFiles.length > 0 && (
                                <div className='space-y-3'>
                                    <div className='flex items-center justify-between'>
                                        <span className='text-sm font-semibold text-white'>
                                            Selected Files ({selectedFiles.length})
                                        </span>
                                        {selectedFiles.filter(f => f.error).length > 0 && (
                                            <span className='text-xs text-red-400 font-medium'>
                                                {selectedFiles.filter(f => f.error).length} invalid
                                            </span>
                                        )}
                                    </div>
                                    <div className='max-h-64 overflow-y-auto space-y-2 rounded-lg border border-white/10 bg-white/5 p-3'>
                                        {selectedFiles.map(({ file, error }, index) => (
                                            <div 
                                                key={index} 
                                                className={`flex items-start justify-between p-3 rounded-lg border transition-colors ${
                                                    error ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10 hover:border-white/20'
                                                }`}
                                            >
                                                <div className='flex items-start gap-3 flex-1 min-w-0'>
                                                    {error ? (
                                                        <XCircle className='h-4 w-4 text-red-400 flex-shrink-0 mt-0.5' />
                                                    ) : (
                                                        <FileText className='h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5' />
                                                    )}
                                                    <div className='flex-1 min-w-0'>
                                                        <p className={`text-sm font-medium truncate ${error ? 'text-red-300' : 'text-white'}`}>
                                                            {file.name}
                                                        </p>
                                                        <p className='text-xs text-slate-400'>{formatFileSize(file.size)}</p>
                                                        {error && (
                                                            <p className='text-xs text-red-400 mt-1 font-medium'>{error}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeSelectedFile(index)}
                                                    disabled={isUploadingFiles}
                                                    className='flex-shrink-0 p-1.5 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50'
                                                    title='Remove file'
                                                >
                                                    <Trash2 className={`h-4 w-4 ${error ? 'text-red-400' : 'text-red-500'}`} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <button 
                                        onClick={uploadSelectedFiles}
                                        className='w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold shadow-lg shadow-cyan-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
                                        disabled={
                                            isUploadingFiles || 
                                            isUploading || 
                                            selectedFiles.some(f => f.error)
                                        }
                                    >
                                        {isUploadingFiles ? (
                                            <span className='flex items-center justify-center gap-2'>
                                                <LucideLoader2 className='h-4 w-4 animate-spin' />
                                                Uploading...
                                            </span>
                                        ) : (
                                            <span className='flex items-center justify-center gap-2'>
                                                <Upload className='h-4 w-4' />
                                                Upload {selectedFiles.filter(f => !f.error).length} Valid File{selectedFiles.filter(f => !f.error).length !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Uploaded Files List */}
                    <div className='rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl'>
                        <div className='border-b border-white/10 p-6'>
                            <div className='flex items-center justify-between'>
                                <div>
                                    <div className='flex items-center gap-2 mb-2'>
                                        <FileText className='h-5 w-5 text-cyan-400' />
                                        <h2 className='text-xl font-bold text-white'>Uploaded Files</h2>
                                    </div>
                                    <p className='text-sm text-slate-400'>Files ready for indexing</p>
                                </div>
                                <button 
                                    onClick={loadFileList} 
                                    className='p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50'
                                    disabled={isLoadingFiles}
                                >
                                    <RefreshCcw className={`h-4 w-4 text-slate-400 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>
                        <div className='p-6'>
                            <div className='space-y-4'>
                                {isLoadingFiles ? (
                                    <div className='flex items-center justify-center py-12'>
                                        <LucideLoader2 className='h-8 w-8 animate-spin text-cyan-400' />
                                    </div>
                                ) : fileList.length === 0 ? (
                                    <div className='text-center py-12'>
                                        <FileText className='h-16 w-16 mx-auto mb-3 text-slate-600' />
                                        <p className='text-sm text-slate-400'>No files uploaded yet</p>
                                    </div>
                                ) : (
                                    <div className='max-h-96 overflow-y-auto space-y-2 rounded-lg border border-white/10 bg-white/5 p-3'>
                                        {fileList.map((file, index) => (
                                            <div key={index} className='flex items-center justify-between gap-3 bg-white/5 hover:bg-white/10 p-3 rounded-lg border border-white/10 hover:border-white/20 transition-colors'>
                                                <div className='flex items-center gap-3 flex-1 min-w-0'>
                                                    <FileText className='h-4 w-4 text-cyan-400 flex-shrink-0' />
                                                    <span className='text-sm font-medium text-white truncate'>{file}</span>
                                                </div>
                                                <button
                                                    onClick={() => deleteUploadedFile(file)}
                                                    disabled={isUploading || isUploadingFiles}
                                                    className='flex-shrink-0 p-1.5 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50'
                                                    title='Delete file'
                                                >
                                                    <Trash2 className='h-4 w-4 text-red-500' />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                <div className='pt-2 space-y-3'>
                                    <p className='text-xs text-slate-400'>
                                        {fileList.length} file{fileList.length !== 1 ? 's' : ''} ready to index
                                    </p>
                                    <button 
                                        onClick={indexToVectorDB}
                                        className='w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold shadow-lg shadow-cyan-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
                                        disabled={isUploading || fileList.length === 0}
                                    >
                                        {isUploading ? (
                                            <span className='flex items-center justify-center gap-2'>
                                                <LucideLoader2 className='h-5 w-5 animate-spin' />
                                                Indexing...
                                            </span>
                                        ) : (
                                            <span className='flex items-center justify-center gap-2'>
                                                <Database className='h-5 w-5' />
                                                Index to Vector DB
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Indexing Progress */}
                {isUploading && (
                    <div className='rounded-xl border-2 border-cyan-500/30 bg-cyan-500/10 backdrop-blur-xl shadow-2xl'>
                        <div className='p-6 space-y-4'>
                            <div className='flex items-center justify-between'>
                                <span className='text-base font-semibold text-white'>Indexing Progress</span>
                                <span className='text-sm font-medium text-cyan-400'>{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className='h-2 bg-white/10' />
                            {filename && (
                                <div className='flex items-center gap-2 text-sm text-slate-300'>
                                    <LucideLoader2 className='h-4 w-4 animate-spin text-cyan-400' />
                                    <span className='truncate'>{filename}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default VectorDBPage




