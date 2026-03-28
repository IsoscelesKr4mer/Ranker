import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Check, Loader2 } from 'lucide-react';
import { uploadListImage } from '@/lib/database';

export interface LibraryImage {
  id: string;
  url: string;
  name: string;
  status: 'uploading' | 'ready' | 'error';
  error?: string;
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

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter(f => {
        if (!ACCEPTED_TYPES.includes(f.type)) return false;
        if (f.size > MAX_FILE_SIZE) return false;
        return true;
      });

      if (fileArray.length === 0) return;

      // Create entries with local object URLs immediately
      const newImages: LibraryImage[] = fileArray.map((f, i) => ({
        id: `upload-${Date.now()}-${i}`,
        url: URL.createObjectURL(f),
        name: f.name,
        status: 'uploading' as const,
      }));

      const updated = [...images, ...newImages];
      onImagesChange(updated);

      // Try to upload to Supabase; fall back to local object URLs
      const results = await Promise.allSettled(
        fileArray.map(async (file, i) => {
          const result = await uploadListImage(file);
          return { index: i, result };
        })
      );

      // Resolve final URLs and update statuses
      const finalUrls: Record<string, string> = {};

      onImagesChange(prev => {
        const next = [...prev];
        results.forEach(settled => {
          if (settled.status === 'fulfilled') {
            const { index, result } = settled.value;
            const entry = newImages[index];
            const entryIndex = next.findIndex(img => img.id === entry.id);
            if (entryIndex !== -1) {
              if ('url' in result) {
                URL.revokeObjectURL(next[entryIndex].url);
                next[entryIndex] = {
                  ...next[entryIndex],
                  url: result.url,
                  status: 'ready',
                };
                finalUrls[entry.id] = result.url;
              } else {
                // Supabase failed — keep the local object URL so it still works
                next[entryIndex] = {
                  ...next[entryIndex],
                  status: 'ready',
                };
                finalUrls[entry.id] = next[entryIndex].url;
              }
            }
          }
        });
        return next;
      });

      // Auto-create items from filenames when not in pick mode
      if (onItemsCreated && !pickMode) {
        const autoItems = newImages.map(img => ({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: filenameToTitle(img.name),
          imageUrl: finalUrls[img.id] || img.url,
        }));
        onItemsCreated(autoItems);
      }
    },
    [images, onImagesChange, onItemsCreated, pickMode]
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

                    {/* Error overlay */}
                    {img.status === 'error' && (
                      <div className="absolute inset-0 bg-red-900/60 flex items-center justify-center">
                        <X className="w-5 h-5 text-red-300" />
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

                  {/* Remove button */}
                  {!pickMode && (
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(img.id);
                      }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <X className="w-3 h-3" />
                    </motion.button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Compact upload for pick mode */}
      {pickMode && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-white/[0.12] hover:border-white/[0.25] hover:bg-white/[0.03] text-white/50 hover:text-white/70 transition-all text-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            {images.length === 0 ? 'Upload an image' : 'Upload more'}
          </button>
        </div>
      )}
    </div>
  );
}
