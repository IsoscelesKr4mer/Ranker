import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, X, Film, Music, Gamepad2, Utensils, BookOpen, AlertCircle, Image as ImageIcon, Upload, Import } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { PageLayout } from '@/components/layout';
import { searchMovies, searchTV, tmdbToRankItem, tmdbTVToRankItem } from '@/lib/tmdb';
import { searchGames, igdbToRankItem } from '@/lib/igdb';
import { searchMusic, deezerToRankItem, type MusicSearchType } from '@/lib/deezer';
import { isValidLetterboxdUrl, importLetterboxdList } from '@/lib/letterboxd';
import { saveList } from '@/lib/database';
import { useAuthStore } from '@/store/authStore';
import { ImageLibrary } from '@/components/ImageLibrary';
import type { LibraryImage } from '@/components/ImageLibrary';
import type { RankItem } from '@/types';

const CATEGORIES = [
  { id: 'Movies', label: 'Movies', icon: Film },
  { id: 'TV', label: 'TV', icon: Film },
  { id: 'Games', label: 'Games', icon: Gamepad2 },
  { id: 'Music', label: 'Music', icon: Music },
  { id: 'Food', label: 'Food', icon: Utensils },
  { id: 'Custom', label: 'Custom', icon: BookOpen },
];

export default function CreateList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  // Form state
  const [listTitle, setListTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Custom');
  const [musicSearchType, setMusicSearchType] = useState<MusicSearchType>('track');
  const [isCommunity, setIsCommunity] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Letterboxd import state
  const [letterboxdUrl, setLetterboxdUrl] = useState('');
  const [letterboxdValidation, setLetterboxdValidation] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [letterboxdImporting, setLetterboxdImporting] = useState(false);
  const [letterboxdError, setLetterboxdError] = useState<string | null>(null);
  const [letterboxdSuccess, setLetterboxdSuccess] = useState<number | null>(null);

  const handleLetterboxdImport = useCallback(async () => {
    if (!isValidLetterboxdUrl(letterboxdUrl)) return;
    setLetterboxdImporting(true);
    setLetterboxdError(null);
    setLetterboxdSuccess(null);
    try {
      const imported = await importLetterboxdList(letterboxdUrl);
      if (imported.length === 0) {
        setLetterboxdError('No films found. Make sure the list is public and the URL is correct.');
        setLetterboxdImporting(false);
        return;
      }
      // Enhance with TMDb posters
      const enhanced = await Promise.all(
        imported.map(async (item) => {
          try {
            const { movies } = await searchMovies(item.title);
            if (movies.length > 0 && movies[0].poster_path) {
              return {
                ...item,
                imageUrl: `https://image.tmdb.org/t/p/w500${movies[0].poster_path}`,
                subtitle: movies[0].release_date?.slice(0, 4) || item.subtitle,
              };
            }
          } catch { /* keep original */ }
          return item;
        })
      );
      setItems(prev => [...prev, ...enhanced]);
      setSelectedCategory('Movies');
      setLetterboxdSuccess(enhanced.length);
      setLetterboxdUrl('');
      setLetterboxdValidation('idle');
      setTimeout(() => setLetterboxdSuccess(null), 5000);
    } catch (err) {
      console.error('Letterboxd import failed:', err);
      setLetterboxdError('Failed to import from Letterboxd. Please check the URL and try again.');
    } finally {
      setLetterboxdImporting(false);
    }
  }, [letterboxdUrl]);

  // Auto-import if arriving from Browse page with a Letterboxd URL
  const hasAutoImported = useRef(false);
  useEffect(() => {
    const state = location.state as { letterboxdUrl?: string } | null;
    if (state?.letterboxdUrl && !hasAutoImported.current) {
      hasAutoImported.current = true;
      setLetterboxdUrl(state.letterboxdUrl);
      // Trigger import directly since setLetterboxdUrl won't update in time for the callback
      (async () => {
        setLetterboxdImporting(true);
        setLetterboxdError(null);
        try {
          const imported = await importLetterboxdList(state.letterboxdUrl!);
          if (imported.length === 0) {
            setLetterboxdError('No films found. Make sure the list is public and the URL is correct.');
            setLetterboxdImporting(false);
            return;
          }
          const enhanced = await Promise.all(
            imported.map(async (item) => {
              try {
                const { movies } = await searchMovies(item.title);
                if (movies.length > 0 && movies[0].poster_path) {
                  return {
                    ...item,
                    imageUrl: `https://image.tmdb.org/t/p/w500${movies[0].poster_path}`,
                    subtitle: movies[0].release_date?.slice(0, 4) || item.subtitle,
                  };
                }
              } catch { /* keep original */ }
              return item;
            })
          );
          setItems(enhanced);
          setSelectedCategory('Movies');
          setLetterboxdSuccess(enhanced.length);
          setLetterboxdUrl('');
          setTimeout(() => setLetterboxdSuccess(null), 5000);
        } catch (err) {
          console.error('Letterboxd import failed:', err);
          setLetterboxdError('Failed to import from Letterboxd. Please check the URL and try again.');
        } finally {
          setLetterboxdImporting(false);
        }
      })();
    }
  }, [location.state]);

  // TMDb search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addedSearchIds, setAddedSearchIds] = useState<Set<string | number>>(new Set());
  const searchTimeoutRef = useRef<number | undefined>(undefined);

  // Manual item add state
  const [manualItemTitle, setManualItemTitle] = useState('');

  // Image library state
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
  const [assigningItemId, setAssigningItemId] = useState<string | null>(null);

  // Items state
  const [items, setItems] = useState<RankItem[]>([]);

  // Search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setAddedSearchIds(new Set());
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const performSearch = async () => {
      setIsSearching(true);
      try {
        if (selectedCategory === 'Games') {
          const { games } = await searchGames(searchQuery);
          setSearchResults(games || []);
        } else if (selectedCategory === 'TV') {
          const { shows } = await searchTV(searchQuery);
          setSearchResults(shows || []);
        } else if (selectedCategory === 'Music') {
          const { results } = await searchMusic(searchQuery, musicSearchType);
          setSearchResults(results || []);
        } else {
          const { movies } = await searchMovies(searchQuery);
          setSearchResults(movies || []);
        }
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    searchTimeoutRef.current = setTimeout(performSearch, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, selectedCategory, musicSearchType]);

  const handleAddSearchResult = useCallback((result: any) => {
    if (addedSearchIds.has(result.id)) {
      // Tap again on a checkmarked result to remove it from the list
      setItems(prev => prev.filter(item => item.metadata?.searchResultId !== result.id));
      setAddedSearchIds(prev => {
        const next = new Set(prev);
        next.delete(result.id);
        return next;
      });
      return;
    }
    let rankItem;
    if (selectedCategory === 'Games') {
      rankItem = igdbToRankItem(result);
    } else if (selectedCategory === 'TV') {
      rankItem = tmdbTVToRankItem(result);
    } else if (selectedCategory === 'Music') {
      rankItem = deezerToRankItem(result);
    } else {
      rankItem = tmdbToRankItem(result);
    }
    const rankItemWithMeta = { ...rankItem, metadata: { ...(rankItem.metadata || {}), searchResultId: result.id } };
    setItems(prev => [...prev, rankItemWithMeta]);
    setAddedSearchIds(prev => new Set([...prev, result.id]));
  }, [selectedCategory, addedSearchIds]);

  const handleAddManualItem = useCallback(() => {
    if (!manualItemTitle.trim()) return;

    const newItem: RankItem = {
      id: `manual-${Date.now()}-${Math.random()}`,
      title: manualItemTitle,
      imageUrl: null,
      subtitle: undefined,
    };

    setItems(prev => [...prev, newItem]);
    setManualItemTitle('');
  }, [manualItemTitle]);

  const handleAssignImage = useCallback((itemId: string, imageUrl: string) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, imageUrl } : item
    ));
    setAssigningItemId(null);
  }, []);

  const handleImageItemsCreated = useCallback((newItems: { id: string; title: string; imageUrl: string }[]) => {
    setItems(prev => [
      ...prev,
      ...newItems.map(item => ({
        ...item,
        imageUrl: item.imageUrl as string | null,
        subtitle: undefined,
      })),
    ]);
  }, []);

  const handleLibraryImageClick = useCallback((url: string) => {
    // Find the library image to get its filename for the title
    const img = libraryImages.find(i => i.url === url);
    if (!img) return;

    // Check if an item with this image already exists
    if (items.some(item => item.imageUrl === url)) return;

    const newItem: RankItem = {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: img.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase()),
      imageUrl: url,
      subtitle: undefined,
    };
    setItems(prev => [...prev, newItem]);
  }, [libraryImages, items]);

  const handleRemoveItem = useCallback((id: string) => {
    setItems(prev => {
      const itemToRemove = prev.find(item => item.id === id);
      if (itemToRemove?.metadata?.searchResultId !== undefined) {
        const searchId = itemToRemove.metadata.searchResultId as string | number;
        setAddedSearchIds(prevIds => {
          const next = new Set(prevIds);
          next.delete(searchId);
          return next;
        });
      }
      return prev.filter(item => item.id !== id);
    });
  }, []);

  // CSV upload state
  const [csvDragOver, setCsvDragOver] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvItemCount, setCsvItemCount] = useState<number | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = useCallback((text: string): RankItem[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];

    // Detect if first line is a header row
    const firstLine = lines[0].toLowerCase().trim();
    const hasHeader = /^(title|name|item)/.test(firstLine);
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const parsed: RankItem[] = [];

    for (const line of dataLines) {
      // Parse CSV respecting quoted fields
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      fields.push(current.trim());

      const title = fields[0]?.replace(/^["']|["']$/g, '').trim();
      if (!title) continue;

      const subtitle = fields[1]?.replace(/^["']|["']$/g, '').trim() || undefined;
      const imageUrl = fields[2]?.replace(/^["']|["']$/g, '').trim() || null;

      parsed.push({
        id: `csv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        imageUrl: imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) ? imageUrl : null,
        subtitle,
      });
    }

    return parsed;
  }, []);

  const handleCSVFile = useCallback((file: File) => {
    setCsvError(null);
    setCsvItemCount(null);

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.tsv') && !file.name.endsWith('.txt')) {
      setCsvError('Please upload a .csv, .tsv, or .txt file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setCsvError('File too large (max 2 MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text?.trim()) {
        setCsvError('File is empty');
        return;
      }

      // Handle TSV by converting tabs to commas
      const normalized = file.name.endsWith('.tsv') ? text.replace(/\t/g, ',') : text;
      const newItems = parseCSV(normalized);

      if (newItems.length === 0) {
        setCsvError('No valid items found in file');
        return;
      }

      setItems(prev => [...prev, ...newItems]);
      setCsvItemCount(newItems.length);

      // Clear success message after 4s
      setTimeout(() => setCsvItemCount(null), 4000);
    };
    reader.onerror = () => setCsvError('Failed to read file');
    reader.readAsText(file);
  }, [parseCSV]);

  const handleCSVDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setCsvDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleCSVFile(file);
  }, [handleCSVFile]);

  const handleCSVInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleCSVFile(file);
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  }, [handleCSVFile]);

  const handleStartRanking = async () => {
    if (items.length < 3) return;

    setSaveError(null);

    // If user is authenticated, save the list to Supabase first
    if (user) {
      setIsSaving(true);
      try {
        const tags = tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        const result = await saveList({
          title: listTitle,
          category: selectedCategory,
          source: 'web',
          items,
          isCommunity,
          isPublic: true,
          tags,
        });

        if ('error' in result) {
          setSaveError(result.error);
          setIsSaving(false);
          return;
        }

        // Navigate with listId if successfully saved
        navigate('/ranking/custom', {
          state: {
            listId: result.listId,
            listTitle,
            category: selectedCategory,
            items,
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to save list';
        setSaveError(errorMessage);
        setIsSaving(false);
      }
    } else {
      // Not authenticated, navigate with items in state (list can be saved later)
      navigate('/ranking/custom', {
        state: {
          listTitle,
          category: selectedCategory,
          items,
        },
      });
    }
  };

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveListOnly = async () => {
    if (!listTitle.trim() || items.length === 0) return;
    if (!user) {
      setSaveError('Sign in to save your list.');
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    try {
      const tags = tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      const result = await saveList({
        title: listTitle,
        category: selectedCategory,
        source: 'web',
        items,
        isCommunity,
        isPublic: true,
        tags,
      });

      if ('error' in result) {
        setSaveError(result.error);
      } else {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 4000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save list';
      setSaveError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const isSearchableCategory = selectedCategory === 'Movies' || selectedCategory === 'TV' || selectedCategory === 'Games' || selectedCategory === 'Music';
  const canStartRanking = items.length >= 3 && listTitle.trim();
  const canSave = items.length > 0 && listTitle.trim() && user;

  return (
    <PageLayout maxWidth="lg">
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl font-bold text-white">Create a List</h1>
          <p className="text-white/50">Build your custom ranking list</p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column: Form & Add Items */}
          <div className="lg:col-span-2 space-y-6">
            {/* List Title */}
            <Card padding="lg" className="space-y-4">
              <label className="block text-sm font-medium text-white/60">List Title</label>
              <Input
                type="text"
                placeholder="e.g., Best Horror Movies, Video Games of 2024, Top Desserts..."
                value={listTitle}
                onChange={e => setListTitle(e.target.value)}
              />
            </Card>

            {/* Category Selector */}
            <Card padding="lg" className="space-y-4">
              <label className="block text-sm font-medium text-white/60">Category</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map(category => {
                  const Icon = category.icon;
                  return (
                    <motion.button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`
                        flex items-center justify-center gap-2 px-3 py-3 rounded-lg
                        font-medium text-sm transition-all duration-200
                        ${selectedCategory === category.id
                          ? 'bg-violet-600/20 border border-violet-500/50 text-violet-300'
                          : 'bg-white/[0.03] border border-white/[0.06] text-white/60 hover:text-white/80'
                        }
                      `}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{category.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </Card>

            {/* TMDb Search (Movies/TV only) */}
            {isSearchableCategory && (
              <Card padding="lg" className="space-y-4">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-white/60">
                    {`Search ${selectedCategory === 'Movies' ? 'Movies' : selectedCategory === 'TV' ? 'TV Shows' : selectedCategory === 'Games' ? 'Games' : musicSearchType === 'album' ? 'Albums' : musicSearchType === 'artist' ? 'Artists' : 'Songs'}`}
                  </label>

                  {/* Music sub-type picker */}
                  {selectedCategory === 'Music' && (
                    <div className="flex gap-1.5">
                      {([['track', 'Songs'], ['album', 'Albums'], ['artist', 'Artists']] as const).map(([type, label]) => (
                        <button
                          key={type}
                          onClick={() => { setMusicSearchType(type); setSearchQuery(''); setSearchResults([]); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            musicSearchType === type
                              ? 'bg-violet-600 text-white'
                              : 'bg-white/[0.05] text-white/50 hover:text-white/70 hover:bg-white/[0.08]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="relative">
                    <Search className="absolute left-4 top-3.5 w-4 h-4 text-white/25 pointer-events-none" />
                    <Input
                      type="text"
                      placeholder={`Search ${selectedCategory === 'Movies' ? 'movies' : selectedCategory === 'TV' ? 'TV shows' : selectedCategory === 'Games' ? 'games' : musicSearchType === 'album' ? 'albums' : musicSearchType === 'artist' ? 'artists' : 'songs'}...`}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-12"
                    />
                  </div>

                  {/* Search Results */}
                  <AnimatePresence>
                    {(isSearching || searchResults.length > 0) && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-[28rem] overflow-y-auto"
                      >
                        {isSearching ? (
                          <div className="col-span-full py-8 text-center">
                            <div className="inline-flex items-center gap-2 text-white/50">
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              <span className="text-sm">Searching...</span>
                            </div>
                          </div>
                        ) : (
                          searchResults.map(result => {
                            const isGame = selectedCategory === 'Games';
                            const isMusic = selectedCategory === 'Music';
                            const displayTitle = isMusic ? result.title
                              : isGame ? result.name
                              : (result.title || result.name);
                            const displayYear = isMusic ? result.artist
                              : isGame ? result.releaseDate
                              : (result.release_date || result.first_air_date)?.slice(0, 4);
                            const imageUrl = isMusic ? result.imageUrl
                              : isGame ? result.cover
                              : result.poster_path ? `https://image.tmdb.org/t/p/w200${result.poster_path}` : null;
                            const isAdded = addedSearchIds.has(result.id);
                            return (
                              <div key={result.id} className="relative w-full" style={{ paddingBottom: isMusic ? '100%' : '150%' }}>
                                <motion.button
                                  onClick={() => handleAddSearchResult(result)}
                                  disabled={isAdded}
                                  className={`group absolute inset-0 rounded-lg overflow-hidden ${isAdded ? 'cursor-default' : ''}`}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  {imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt={displayTitle}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-violet-500/10 to-violet-500/5 flex items-center justify-center">
                                      {isMusic ? <Music className="w-5 h-5 text-white/30" /> : isGame ? <Gamepad2 className="w-5 h-5 text-white/30" /> : <Film className="w-5 h-5 text-white/30" />}
                                    </div>
                                  )}
                                  {isAdded ? (
                                    <div className="absolute inset-0 bg-emerald-500/40 flex items-center justify-center">
                                      <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="absolute inset-0 bg-black/50 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Plus className="w-6 h-6 text-white" />
                                    </div>
                                  )}
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                    <p className="text-xs text-white font-semibold line-clamp-2">{displayTitle}</p>
                                    {displayYear && (
                                      <p className="text-xs text-white/50">{displayYear}</p>
                                    )}
                                  </div>
                                </motion.button>
                              </div>
                            );
                          })
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Card>
            )}

            {/* Manual Item Add */}
            <Card padding="lg" className="space-y-4">
              <label className="block text-sm font-medium text-white/60">Add Item Manually</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Item title or name"
                  value={manualItemTitle}
                  onChange={e => setManualItemTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddManualItem()}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddManualItem}
                  variant="secondary"
                  disabled={!manualItemTitle.trim()}
                >
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </div>
            </Card>

            {/* CSV Upload */}
            <Card padding="lg" className="space-y-4">
              <label className="block text-sm font-medium text-white/60">Import from CSV</label>
              <p className="text-xs text-white/40 -mt-2">
                Upload a CSV with columns: title, subtitle (optional), image URL (optional)
              </p>
              <div
                onDragOver={(e) => { e.preventDefault(); setCsvDragOver(true); }}
                onDragLeave={() => setCsvDragOver(false)}
                onDrop={handleCSVDrop}
                onClick={() => csvInputRef.current?.click()}
                className={`
                  relative flex flex-col items-center justify-center gap-2 p-6
                  rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
                  ${csvDragOver
                    ? 'border-violet-400/60 bg-violet-500/10'
                    : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]'
                  }
                `}
              >
                <Upload className={`w-6 h-6 ${csvDragOver ? 'text-violet-400' : 'text-white/30'}`} />
                <p className="text-sm text-white/50">
                  {csvDragOver ? 'Drop CSV here' : 'Drag & drop a CSV, or click to browse'}
                </p>
                <p className="text-xs text-white/30">.csv, .tsv, or .txt</p>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleCSVInputChange}
                  className="hidden"
                />
              </div>

              <AnimatePresence>
                {csvError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-2 text-sm text-red-400"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {csvError}
                  </motion.div>
                )}
                {csvItemCount !== null && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-sm text-emerald-400"
                  >
                    Added {csvItemCount} {csvItemCount === 1 ? 'item' : 'items'} from CSV
                  </motion.p>
                )}
              </AnimatePresence>
            </Card>

            {/* Letterboxd Import */}
            <Card padding="lg" className="space-y-4">
              <label className="block text-sm font-medium text-white/60">Import from Letterboxd</label>
              <p className="text-xs text-white/40 -mt-2">
                Paste a public Letterboxd list, watchlist, or film collection URL to add films to your list
              </p>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="https://letterboxd.com/username/list/list-name/"
                    value={letterboxdUrl}
                    onChange={e => { setLetterboxdUrl(e.target.value); setLetterboxdValidation('idle'); setLetterboxdError(null); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        if (isValidLetterboxdUrl(letterboxdUrl)) {
                          handleLetterboxdImport();
                        } else {
                          setLetterboxdValidation('invalid');
                        }
                      }
                    }}
                    disabled={letterboxdImporting}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => {
                      if (isValidLetterboxdUrl(letterboxdUrl)) {
                        handleLetterboxdImport();
                      } else {
                        setLetterboxdValidation('invalid');
                      }
                    }}
                    variant="primary"
                    disabled={!letterboxdUrl.trim() || letterboxdImporting}
                  >
                    {letterboxdImporting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Importing...
                      </>
                    ) : (
                      <>
                        <Import className="w-4 h-4" />
                        Import
                      </>
                    )}
                  </Button>
                </div>

                <AnimatePresence>
                  {letterboxdValidation === 'invalid' && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-300 text-sm flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                      Invalid URL. Please enter a valid Letterboxd link.
                    </motion.div>
                  )}
                  {letterboxdError && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="flex items-center gap-2 text-sm text-red-400"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {letterboxdError}
                    </motion.div>
                  )}
                  {letterboxdSuccess !== null && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="text-sm text-emerald-400"
                    >
                      Imported {letterboxdSuccess} {letterboxdSuccess === 1 ? 'film' : 'films'} from Letterboxd
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              <div className="space-y-1 text-xs text-white/28 font-mono pt-2 border-t border-white/[0.07]">
                <p className="text-white/38 font-sans font-semibold mb-1.5">Example URLs:</p>
                <p>letterboxd.com/username/list/list-name/</p>
                <p>letterboxd.com/username/watchlist/</p>
                <p>letterboxd.com/username/films/</p>
              </div>
            </Card>

            {/* Image Library */}
            <Card padding="lg" className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-white/60">Image Library</label>
                {libraryImages.length > 0 && (
                  <span className="text-xs text-white/35">
                    {libraryImages.filter(i => i.status === 'ready').length} ready
                  </span>
                )}
              </div>
              <p className="text-xs text-white/40 -mt-2">
                Upload images to auto-create items. Click any unused image to add it back.
              </p>
              <ImageLibrary
                images={libraryImages}
                onImagesChange={setLibraryImages}
                onItemsCreated={handleImageItemsCreated}
                onSelectImage={handleLibraryImageClick}
                inUseUrls={new Set(items.filter(i => i.imageUrl).map(i => i.imageUrl as string))}
              />
            </Card>
          </div>

          {/* Right Column: Items List */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
              <Card padding="lg" className="space-y-4">
                <div className="space-y-1">
                  <h3 className="font-semibold text-white">Items Added</h3>
                  <p className="text-sm text-white/50">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                    {items.length > 0 && items.length < 3 && (
                      <span className="text-red-400 block">Add {3 - items.length} more to start</span>
                    )}
                  </p>
                </div>

                {/* Items Scroll */}
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  <AnimatePresence mode="popLayout">
                    {items.length > 0 ? (
                      items.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-2"
                        >
                          <div className="flex items-center gap-2 p-2 bg-white/[0.03] border border-white/[0.06] rounded-lg group hover:bg-white/[0.05] transition-colors">
                            {/* Image thumbnail — click to assign */}
                            <button
                              type="button"
                              onClick={() => {
                                setAssigningItemId(assigningItemId === item.id ? null : item.id);
                              }}
                              className="flex-shrink-0"
                              title={item.imageUrl ? 'Change image' : 'Add image'}
                            >
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.title}
                                  className="w-10 h-10 rounded object-cover hover:ring-2 hover:ring-violet-400/50 transition-all"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded bg-gradient-to-br from-violet-500/20 to-violet-500/10 flex items-center justify-center hover:from-violet-500/30 hover:to-violet-500/15 transition-colors cursor-pointer">
                                  <ImageIcon className="w-4 h-4 text-violet-400/60" />
                                </div>
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-white/90 truncate font-medium">{item.title}</p>
                              {item.subtitle && (
                                <p className="text-xs text-white/40 truncate">{item.subtitle}</p>
                              )}
                            </div>
                            <motion.button
                              onClick={() => handleRemoveItem(item.id)}
                              className="flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <X className="w-4 h-4 text-red-400 hover:text-red-300" />
                            </motion.button>
                          </div>

                          {/* Inline image picker when this item is being assigned */}
                          <AnimatePresence>
                            {assigningItemId === item.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                                ref={(el) => {
                                  if (el) {
                                    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
                                  }
                                }}
                              >
                                <div className="p-2 bg-white/[0.03] border border-violet-500/20 rounded-lg">
                                  <ImageLibrary
                                    images={libraryImages}
                                    onImagesChange={setLibraryImages}
                                    onSelectImage={(url) => handleAssignImage(item.id, url)}
                                    selectedUrl={item.imageUrl}
                                    pickMode
                                  />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      ))
                    ) : (
                      <div className="py-12 text-center">
                        <p className="text-white/40 text-sm">No items added yet</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </Card>

              {/* Tags */}
              <Card padding="lg" className="space-y-3">
                <label className="block text-sm font-medium text-white/60">Tags <span className="text-white/30 font-normal">(optional)</span></label>
                <Input
                  type="text"
                  placeholder="e.g., apex legends, characters, battle royale"
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                />
                <p className="text-xs text-white/35">Separate tags with commas. Helps others find your list.</p>
              </Card>

              {/* Submit to Community Toggle */}
              {user && (
                <Card padding="lg" className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCommunity}
                      onChange={e => setIsCommunity(e.target.checked)}
                      className="w-5 h-5 rounded border border-white/20 bg-white/5 accent-violet-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">Submit to Community</p>
                      <p className="text-xs text-white/50">Share your list with other users</p>
                    </div>
                  </label>
                </Card>
              )}

              {/* Success Message */}
              <AnimatePresence>
                {savedSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
                  >
                    <p className="text-sm text-emerald-300">List saved{isCommunity ? ' to community' : ''}! You can find it on your dashboard.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Message */}
              {saveError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{saveError}</p>
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                {/* Start Ranking Button */}
                <motion.div
                  animate={{
                    scale: canStartRanking ? 1 : 0.95,
                    opacity: canStartRanking ? 1 : 0.6,
                  }}
                >
                  <Button
                    onClick={handleStartRanking}
                    variant={canStartRanking ? 'primary' : 'secondary'}
                    fullWidth
                    size="lg"
                    disabled={!canStartRanking || isSaving}
                    className="w-full"
                  >
                    <span>{isSaving ? 'Saving...' : 'Save & Start Ranking'}</span>
                    {items.length > 0 && !isSaving && (
                      <span className="text-sm font-normal opacity-80">({items.length})</span>
                    )}
                  </Button>
                </motion.div>

                {/* Save List Only Button */}
                {user && (
                  <Button
                    onClick={handleSaveListOnly}
                    variant="secondary"
                    fullWidth
                    size="md"
                    disabled={!canSave || isSaving}
                    className="w-full"
                  >
                    {isSaving ? 'Saving...' : 'Save List Only'}
                  </Button>
                )}
              </div>

              {items.length > 0 && items.length < 3 && (
                <motion.p
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-white/40 text-center"
                >
                  Add {3 - items.length} more {3 - items.length === 1 ? 'item' : 'items'} to start ranking (or save the list as-is)
                </motion.p>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
