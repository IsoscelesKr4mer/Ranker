import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Check, Loader2, RotateCcw } from 'lucide-react';
import { uploadListImage } from '@/lib/database';

export interface LibraryImage {
  id: string;
  url: string;
  name: string;
  status: 'uploading' | 'ready' | 'error';
  error?: string;
}

/** Number of automatic retry attempts before giving up and surfacing a manual retry button. */
const AUTO_RETRY_ATTEMPTS = 2;
/** Base backoff between retries (ms). Doubles per attempt. */
const RETRY_BACKOFF_MS = 750;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

interface ImageLibraryProps {
  images: LibraryImage[];
  onImagesChange: (images: LibraryImage[] | ((prev: LibraryImage[]) => LibraryImage[])) => void;
  onSelectImage?: (url: string) => void;
  selectedUrl?: string | null;
  /** If true, show in compact "pick" mode for assigning to items */
  pickMode?: boolean;
  /** Called when images are uploaded — provides items auto-created from filenames */
  onItemsCreated?: (items: { id: string; title: string; imageUrl: string }[]) => void;
  /** URLs currently assigned to items — shown with a check overlay */
  inUseUrls?: Set<string>;
}

/** Strip extension, replace separators with spaces, title-case */
function filenameToTitle(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')           // remove extension
    .replace(/[-_]+/g, ' ')            // dashes/underscores → spaces
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase → spaces
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase()); // title case
}

/** Max file size: 5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Per-file upload timeout — Supabase storage can hang silently on flaky networks. */
const UPLOAD_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Upload timed out')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * Compress an image blob/file to a data URL, resized to max 600px wide.
 * Produces a stable, self-contained URL that survives page navigation and
 * can be stored in the database — unlike blob: URLs which are tab-scoped.
 */
function compressToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const blobUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const MAX = 600;
      const scale = img.width > MAX ? MAX / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(blobUrl); resolve(''); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(blobUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(''); };
    img.src = blobUrl;
  });
}

export function ImageLibrary({
  images,
  onImagesChange,
  onSelectImage,
  selectedUrl,
  pickMode = false,
  onItemsCreated,
  inUseUrls,
}: ImageLibraryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Keep the original File handle for each library entry so we can retry failed
  // uploads without making the user re-pick the file. Lives in a ref (not state)
  // because File objects aren't meaningfully serializable and don't need to drive
  // re-renders — only their upload status does.
  const fileMapRef = useRef<Map<string, File>>(new Map());
  // Tracks whether a given entry has already been emitted to onItemsCreated, so
  // a successful retry doesn't create a duplicate item.
  const createdMapRef = useRef<Set<string>>(new Set());

  /**
   * Attempt to upload a single file for an existing library entry, with automatic
   * retry + exponential backoff. If all retries fail, falls back to a compressed
   * data URL so the image is at least usable locally; if even that fails, the
   * entry is marked as an error tile with a manual retry button.
   *
   * Called both for initial uploads and for user-initiated retries — the caller
   * is responsible for flipping the entry back to `'uploading'` state first.
   */
  const uploadOne = useCallback(
    async (entry: LibraryImage, file: File) => {
      // Kick off compression in parallel — it's purely local and cheap.
      const dataUrlPromise = compressToDataUrl(file);

      let finalUrl: string | null = null;
      let lastError: string | null = null;

      for (let attempt = 0; attempt <= AUTO_RETRY_ATTEMPTS; attempt++) {
        try {
          const result = await withTimeout(uploadListImage(file), UPLOAD_TIMEOUT_MS);
          if ('url' in result) {
            finalUrl = result.url;
            break;
          }
          lastError = result.error || 'Upload failed';
        } catch (e) {
          lastError = e instanceof Error ? e.message : 'Upload failed';
        }
        // Don't sleep after the last attempt.
        if (attempt < AUTO_RETRY_ATTEMPTS) {
          await sleep(RETRY_BACKOFF_MS * Math.pow(2, attempt));
        }
      }

      // Fall back to a local data URL if Supabase is hosed — at least the user's
      // list is still usable in this session and the tile shows as ready.
      if (!finalUrl) {
        const dataUrl = await dataUrlPromise;
        if (dataUrl) finalUrl = dataUrl;
      }

      onImagesChange((prev) => {
        const next = [...prev];
        const idx = next.findIndex((img) => img.id === entry.id);
        if (idx !== -1) {
          if (next[idx].url.startsWith('blob:')) {
            URL.revokeObjectURL(next[idx].url);
          }
          next[idx] = {
            ...next[idx],
            url: finalUrl || next[idx].url,
            status: finalUrl ? 'ready' : 'error',
            error: finalUrl ? undefined : lastError || 'Upload failed',
          };
        }
        return next;
      });

      // Only create the item the first time this entry succeeds — retries must
      // not duplicate items.
      if (finalUrl && !createdMapRef.current.has(entry.id) && onItemsCreated && !pickMode) {
        createdMapRef.current.add(entry.id);
        onItemsCreated([{
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: filenameToTitle(entry.name),
          imageUrl: finalUrl,
        }]);
      }
    },
    [onImagesChange, onItemsCreated, pickMode]
  );

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter(f => {
        if (!ACCEPTED_TYPES.includes(f.type)) return false;
        if (f.size > MAX_FILE_SIZE) return false;
        return true;
      });

      if (fileArray.length === 0) return;

      // Create entries with local object URLs immediately for instant preview
      const newImages: LibraryImage[] = fileArray.map((f, i) => ({
        id: `upload-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        url: URL.createObjectURL(f),
        name: f.name,
        status: 'uploading' as const,
      }));

      // Stash each file so retries don't need a re-pick.
      newImages.forEach((entry, i) => {
        fileMapRef.current.set(entry.id, fileArray[i]);
      });

      onImagesChange(prev => [...prev, ...newImages]);

      // Each file settles independently — one stuck upload cannot block others.
      await Promise.all(
        newImages.map((entry, i) => uploadOne(entry, fileArray[i]))
      );
    },
    [onImagesChange, uploadOne]
  );

  /** User-initiated retry from the error overlay button. */
  const handleRetry = useCallback(
    (id: string) => {
      const file = fileMapRef.current.get(id);
      if (!file) return;
      // Flip back to uploading visually and kick a fresh attempt.
      onImagesChange((prev) => {
        const next = [...prev];
        const idx = next.findIndex((img) => img.id === id);
        if (idx !== -1) {
          next[idx] = { ...next[idx], status: 'uploading', error: undefined };
        }
        return next;
      });
      // Use the current entry as a shape carrier; the real state update happens
      // inside uploadOne once it resolves.
      const carrier: LibraryImage = {
        id,
        url: '',
        name: file.name,
        status: 'uploading',
      };
      void uploadOne(carrier, file);
    },
    [onImagesChange, uploadOne]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(e.target.files);
        e.target.value = '';
      }
    },
    [processFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleRemove = useCallback(
    (id: string) => {
      fileMapRef.current.delete(id);
      createdMapRef.current.delete(id);
      onImagesChange(images.filter(img => img.id !== id));
    },
    [images, onImagesChange]
  );

  const readyImages = images.filter(img => img.status === 'ready');
  const uploadingCount = images.filter(img => img.status === 'uploading').length;

  return (
    <div className="space-y-4">
      {/* Hidden file input — always rendered so ref works in both modes */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        onChange={handleFileInput}
        className="hidden"
      />

      {/* Upload Zone */}
      {!pickMode && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 p-6
            flex flex-col items-center justify-center gap-3 text-center
            ${isDragging
              ? 'border-violet-400 bg-violet-500/10'
              : 'border-white/[0.12] hover:border-white/[0.25] hover:bg-white/[0.03]'
            }
          `}
        >
          <Upload className={`w-8 h-8 ${isDragging ? 'text-violet-400' : 'text-white/30'}`} />
          <div>
            <p className="text-sm font-medium text-white/70">
              Drop images here or click to browse
            </p>
            <p className="text-xs text-white/35 mt-1">
              PNG, JPG, WebP, GIF — max 5MB each
            </p>
          </div>
          {uploadingCount > 0 && (
            <div className="flex items-center gap-2 text-violet-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-medium">Uploading {uploadingCount}...</span>
            </div>
          )}
        </div>
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <div>
          {pickMode && (
            <p className="text-xs text-white/40 mb-2">
              {readyImages.length} image{readyImages.length !== 1 ? 's' : ''} in library — click to assign
            </p>
          )}
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            <AnimatePresence mode="popLayout">
              {images.map(img => (
                <motion.div
                  key={img.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative group"
                >
                  {(() => {
                    const isInUse = inUseUrls?.has(img.url) ?? false;
                    const isSelected = img.status === 'ready' && selectedUrl === img.url;
                    return (
                  <button
                    type="button"
                    onClick={() => {
                      if (img.status === 'ready' && onSelectImage && !isInUse) {
                        onSelectImage(img.url);
                      }
                    }}
                    disabled={img.status !== 'ready'}
                    className={`
                      relative w-full rounded-lg overflow-hidden border-2 transition-all
                      ${isSelected
                        ? 'border-violet-400 ring-2 ring-violet-400/30'
                        : isInUse
                          ? 'border-emerald-500/30 opacity-60'
                          : img.status === 'ready'
                            ? 'border-transparent hover:border-white/20 cursor-pointer'
                            : 'border-transparent'
                      }
                    `}
                    style={{ aspectRatio: '1' }}
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-full object-cover"
                    />

                    {/* Uploading overlay */}
                    {img.status === 'uploading' && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}

                    {/* Error overlay — shows retry when we still have the file in memory */}
                    {img.status === 'error' && (
                      <div className="absolute inset-0 bg-red-900/70 flex flex-col items-center justify-center gap-1">
                        <X className="w-4 h-4 text-red-300" />
                        {fileMapRef.current.has(img.id) && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRetry(img.id); }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-medium text-white transition-colors"
                          >
                            <RotateCcw className="w-2.5 h-2.5" /> Retry
                          </button>
                        )}
                      </div>
                    )}

                    {/* In-use check (non-pick mode) */}
                    {isInUse && !pickMode && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/90 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    )}

                    {/* Selected check (pick mode) */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </button>
                  );
                })()}

                {/* Remove button — visible on hover, non-pick mode */}
                {!pickMode && (
                  <button
                    type="button"
                    onClick={() => handleRemove(img.id)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-500/80"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    )}

    {/* Pick mode: allow uploading more images */}
    {pickMode && (
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full text-xs text-white/40 hover:text-white/60 py-2 transition-colors"
      >
        + Upload more images
      </button>
    )}
  </div>
);
}
