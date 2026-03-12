'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, Image as ImageIcon, File, FileVideo, Trash2, Copy } from 'lucide-react';
import useSWR from 'swr';

interface MediaItem {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  file_size: number;
  url: string;
  created_at: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function MediaLibraryPage() {
  const { workspace } = useAuth();
  const [fileType, setFileType] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploadedTitle, setUploadedTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, mutate } = useSWR(
    workspace ? `/api/media/list?workspaceId=${workspace.id}&fileType=${fileType}` : null,
    fetcher
  );

  const mediaItems: MediaItem[] = data?.media || [];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspace) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', workspace.id);
      formData.append('title', uploadedTitle || file.name);

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to upload media');
        return;
      }

      setUploadedTitle('');
      setIsDialogOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      mutate();
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to upload media');
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-6 h-6" />;
    if (mimeType.startsWith('video/')) return <FileVideo className="w-6 h-6" />;
    return <File className="w-6 h-6" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert('Media URL copied');
    } catch {
      alert('Failed to copy URL');
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!confirm('Delete this media item?')) return;

    setDeletingId(mediaId);
    try {
      const response = await fetch(`/api/media/${mediaId}`, {
        method: 'DELETE',
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(payload?.error || 'Failed to delete media');
        return;
      }

      await mutate();
    } catch (error) {
      console.error('Delete media error:', error);
      alert('Failed to delete media');
    } finally {
      setDeletingId((current) => (current === mediaId ? null : current));
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Media Library</h1>
          <p className="text-foreground/60 mt-2">Manage images, videos, and documents for your campaigns</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Upload className="w-4 h-4" />
              Upload Media
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Media</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title (Optional)</label>
                <Input
                  placeholder="Media title"
                  value={uploadedTitle}
                  onChange={(e) => setUploadedTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-4">Select File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  className="w-full"
                />
              </div>
              <p className="text-xs text-foreground/60">
                Supported: Images, Videos, PDF, Documents
              </p>
              {isUploading && (
                <p className="text-sm text-foreground/60">Uploading...</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter by type */}
      <div className="flex gap-2">
        <button
          onClick={() => setFileType('')}
          className={`px-3 py-1 rounded-full text-sm transition-colors ${
            fileType === ''
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground/70 hover:bg-muted/80'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFileType('image')}
          className={`px-3 py-1 rounded-full text-sm transition-colors ${
            fileType === 'image'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground/70 hover:bg-muted/80'
          }`}
        >
          Images
        </button>
        <button
          onClick={() => setFileType('video')}
          className={`px-3 py-1 rounded-full text-sm transition-colors ${
            fileType === 'video'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground/70 hover:bg-muted/80'
          }`}
        >
          Videos
        </button>
        <button
          onClick={() => setFileType('application')}
          className={`px-3 py-1 rounded-full text-sm transition-colors ${
            fileType === 'application'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground/70 hover:bg-muted/80'
          }`}
        >
          Documents
        </button>
      </div>

      {/* Media Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-foreground/60">Loading media...</div>
        </div>
      ) : mediaItems.length === 0 ? (
        <Card className="p-12 text-center">
          <ImageIcon className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No media uploaded</h3>
          <p className="text-foreground/60">Upload images, videos, or documents for your campaigns</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mediaItems.map((item) => (
            <Card key={item.id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-center h-32 bg-muted rounded-lg mb-4">
                {item.file_type.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.title}
                    className="h-full w-full object-cover rounded-lg"
                  />
                ) : item.file_type.startsWith('video/') ? (
                  <video
                    src={item.url}
                    className="h-full w-full object-cover rounded-lg"
                    controls
                  />
                ) : (
                  <div className="text-foreground/40">{getFileIcon(item.file_type)}</div>
                )}
              </div>
              <h3 className="font-semibold text-sm truncate">{item.title}</h3>
              <p className="text-xs text-foreground/60 mt-1">{item.file_name}</p>
              <p className="text-xs text-foreground/50 mt-1">{formatFileSize(item.file_size)}</p>
              <p className="text-xs text-foreground/50 mt-2">
                {new Date(item.created_at).toLocaleDateString()}
              </p>
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1"
                  onClick={() => handleCopyUrl(item.url)}
                >
                  <Copy className="w-3 h-3" />
                  Copy URL
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleDeleteMedia(item.id)}
                  disabled={deletingId === item.id}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
