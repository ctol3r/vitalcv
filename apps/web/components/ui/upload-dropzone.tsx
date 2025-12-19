'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle, File, FileText, Upload, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface UploadedFile {
  file: File;
  id: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  preview?: string;
}

interface UploadDropzoneProps {
  onFilesChange?: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  accept?: Record<string, string[]>;
  className?: string;
  disabled?: boolean;
}

export function UploadDropzone({
  onFilesChange,
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024, // 10MB
  accept = {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  },
  className,
  disabled = false,
}: UploadDropzoneProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
        file,
        id: Math.random().toString(36).substring(7),
        progress: 0,
        status: 'uploading' as const,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      }));

      setUploadedFiles((prev) => {
        const updated = [...prev, ...newFiles].slice(0, maxFiles);
        onFilesChange?.(updated);
        return updated;
      });

      // Simulate upload progress
      newFiles.forEach((uploadFile) => {
        const interval = setInterval(() => {
          setUploadedFiles((prev) =>
            prev.map((f) => {
              if (f.id === uploadFile.id) {
                const newProgress = Math.min(f.progress + 10, 100);
                const newStatus = newProgress === 100 ? 'success' : 'uploading';
                return { ...f, progress: newProgress, status: newStatus };
              }
              return f;
            }),
          );
        }, 200);

        setTimeout(() => clearInterval(interval), 2000);
      });
    },
    [maxFiles, onFilesChange],
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept,
    maxSize,
    maxFiles: maxFiles - uploadedFiles.length,
    disabled,
  });

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      onFilesChange?.(updated);
      return updated;
    });
  };

  const getFileIcon = (file: File) => {
    if (file.type === 'application/pdf') {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    if (file.type.includes('word')) {
      return <FileText className="h-8 w-8 text-blue-500" />;
    }
    return <File className="h-8 w-8 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={cn('space-y-4', className)}>
      <Card
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed transition-colors cursor-pointer',
          isDragActive && 'border-primary bg-primary/5',
          disabled && 'opacity-50 cursor-not-allowed',
          uploadedFiles.length >= maxFiles && 'opacity-50 cursor-not-allowed',
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Upload
            className={cn(
              'h-12 w-12 mb-4',
              isDragActive ? 'text-primary' : 'text-muted-foreground',
            )}
          />
          <div className="space-y-2">
            <p className="text-lg font-medium">
              {isDragActive ? 'Drop files here' : 'Upload documents'}
            </p>
            <p className="text-sm text-muted-foreground">
              Drag & drop files here, or click to select
            </p>
            <p className="text-xs text-muted-foreground">
              Supports PDF, DOC, DOCX up to {formatFileSize(maxSize)}
            </p>
          </div>
          {uploadedFiles.length < maxFiles && (
            <Button variant="outline" className="mt-4 bg-transparent" disabled={disabled}>
              Choose Files
            </Button>
          )}
        </div>
      </Card>

      {fileRejections.length > 0 && (
        <div className="space-y-2">
          {fileRejections.map(({ file, errors }) => (
            <div key={file.name} className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>
                {file.name}: {errors[0]?.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">
            Uploaded Files ({uploadedFiles.length}/{maxFiles})
          </h4>
          {uploadedFiles.map((uploadFile) => (
            <Card key={uploadFile.id} className="p-4">
              <div className="flex items-center gap-3">
                {getFileIcon(uploadFile.file)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium truncate">{uploadFile.file.name}</p>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={uploadFile.status === 'success' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {uploadFile.status === 'success' && (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        )}
                        {uploadFile.status === 'error' && <AlertCircle className="h-3 w-3 mr-1" />}
                        {uploadFile.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadFile.id)}
                        aria-label={`Remove ${uploadFile.file.name}`}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {formatFileSize(uploadFile.file.size)}
                  </p>
                  {uploadFile.status === 'uploading' && (
                    <Progress value={uploadFile.progress} className="h-2" />
                  )}
                </div>
              </div>
              {uploadFile.preview && (
                <div className="mt-3 pt-3 border-t">
                  <img
                    src={uploadFile.preview || '/placeholder.svg'}
                    alt="Preview"
                    className="max-w-full h-32 object-contain rounded"
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
