import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, X, Film, Music, Gamepad2, BookOpen,
  AlertCircle, Image as ImageIcon, Upload, Import, ChevronDown,
  List, ArrowRight, Calendar, BookMarked, Pencil, Copy,
} from 'lucide-react';
import { PageLayout } from '@/components/layout';
import { searchMovies, searchTV, discoverMovies, searchPerson, getPersonMovies, tmdbToRankItem, tmdbTVToRankItem } from '@/lib/tmdb';
import { searchGames, igdbToRankItem } from '@/lib/igdb';
import { searchMusic, deezerToRankItem, type MusicSearchType } from '@/lib/deezer';
import { searchBooks, googleBookToRankItem, type BookSearchType } from '@/lib/googlebooks';
import { isValidLetterboxdUrl, importLetterboxdList } from '@/lib/letterboxd';
import { saveList, updateList } from '@/lib/database';
import { useAuthStore } from '@/store/authStore';
import { ImageLibrary } from '@/components/ImageLibrary';
import type { LibraryImage } from '@/components/ImageLibrary';
import type { RankItem, RankList } from '@/types';

const CATEGORIES = [
  { id: 'Movies', label: 'Movies', icon: Film },
  { id: 'TV', label: 'TV Shows', icon: Film },
  { id: 'Games', label: 'Games', icon: Gamepad2 },
  { id: 'Music', label: 'Music', icon: Music },
  { id: 'Books', label: 'Books', icon: BookMarked },
  { id: 'Custom', label: 'Custom', icon: BookOpen },
];

const Spinner = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export default function CreateList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  // ── Form state ────────────────────────────────────────────────────────────
  const [editListId, setEditListId] = useState<string | null>(null); // non-null = edit mode
  const [listTitle, setListTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Movies');
  const [musicSearchType, setMusicSearchType] = useState<MusicSearchType>('track');
  const [bookSearchType, setBookSearchType] = useState<BookSearchType>('title');
  const [movieSearchType, setMovieSearchType] = useState<'title' | 'actor' | 'director' | 'year'>('title');
  const [personResults, setPersonResults] = useState<any[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<{ id: number; name: string; profilePath: string | null } | null>(null);
  const [isCommunity, setIsCommunity] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // ── Letterboxd import state ───────────────────────────────────────────────
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

  // Pre-populate form when editing an existing list
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current) return;
    const state = location.state as { editList?: RankList; letterboxdUrl?: string } | null;
    if (state?.editList) {
      hasInitialized.current = true;
      const list = state.editList;
      setEditListId(list.id);
      setListTitle(list.title);
      setSelectedCategory(list.category);
      setItems(list.items);
      // Restore any searchResultIds so toggling works correctly
      const addedIds = new Set<string | number>();
      list.items.forEach(item => {
        if (item.metadata?.searchResultId !== undefined) {
          addedIds.add(item.metadata.searchResultId as string | number);
        }
      });
      setAddedSearchIds(addedIds);
    }
  }, [location.state]);

  // Auto-import if arriving from Browse page with a Letterboxd URL
  const hasAutoImported = useRef(false);
  useEffect(() => {
    const state = location.state as { letterboxdUrl?: string } | null;
    if (state?.letterboxdUrl && !hasAutoImported.current) {
      hasAutoImported.current = true;
      setLetterboxdUrl(state.letterboxdUrl);
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

  // ── Search state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addedSearchIds, setAddedSearchIds] = useState<Set<string | number>>(new Set());
  const searchTimeoutRef = useRef<number | undefined>(undefined);
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);

  // ── Year filter / discover state ──────────────────────────────────────────
  const [yearFilter, setYearFilter] = useState('');
  const [discoverSortBy, setDiscoverSortBy] = useState<'release_date.asc' | 'release_date.desc' | 'title.asc' | 'title.desc'>('release_date.asc');
  const [discoverPage, setDiscoverPage] = useState(1);
  const [discoverTotalPages, setDiscoverTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    const hasQuery = searchQuery.trim().length > 0;
    const hasYear = yearFilter.length === 4 && selectedCategory === 'Movies';

    if (!hasQuery && !hasYear && !selectedPerson) {
      setSearchResults([]);
      setAddedSearchIds(new Set());
      setDiscoverPage(1);
      setDiscoverTotalPages(1);
      setSearchOffset(0);
      setSearchHasMore(false);
      return;
    }

    // Person filmography already loaded — sort is client-side, nothing to re-fetch
    if (selectedPerson) return;

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    // Year-browse mode: no text query, valid year, Movies category
    if (!hasQuery && hasYear) {
      const performDiscover = async () => {
        setIsSearching(true);
        setDiscoverPage(1);
        try {
          const { movies, totalPages } = await discoverMovies({
            year: parseInt(yearFilter),
            sortBy: discoverSortBy,
            page: 1,
            theatricalOnly: true,
          });
          setSearchResults(movies || []);
          setDiscoverTotalPages(totalPages);
        } catch (error) {
          console.error('Discover failed:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      };
      searchTimeoutRef.current = setTimeout(performDiscover, 300);
      return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
    }

    // Actor / Director person search
    if (selectedCategory === 'Movies' && (movieSearchType === 'actor' || movieSearchType === 'director') && !selectedPerson) {
      const performPersonSearch = async () => {
        setIsSearching(true);
        try {
          const { people } = await searchPerson(searchQuery);
          setPersonResults(people || []);
          setSearchResults([]);
        } catch (error) {
          console.error('Person search failed:', error);
          setPersonResults([]);
        } finally {
          setIsSearching(false);
        }
      };
      searchTimeoutRef.current = setTimeout(performPersonSearch, 300);
      return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
    }

    // Normal text search (always page/offset 0 — resets on every new query)
    const performSearch = async () => {
      setIsSearching(true);
      setSearchOffset(0);
      setSearchHasMore(false);
      try {
        if (selectedCategory === 'Games') {
          const { games, hasMore } = await searchGames(searchQuery, 0);
          setSearchResults(games || []);
          setSearchHasMore(hasMore);
          setSearchOffset(games?.length ?? 0);
        } else if (selectedCategory === 'TV') {
          const { shows, totalPages } = await searchTV(searchQuery, 1);
          setSearchResults(shows || []);
          setSearchHasMore(totalPages > 1);
          setSearchOffset(shows?.length ?? 0);
        } else if (selectedCategory === 'Music') {
          const { results, hasMore } = await searchMusic(searchQuery, musicSearchType, 0);
          setSearchResults(results || []);
          setSearchHasMore(hasMore);
          setSearchOffset(results?.length ?? 0);
        } else if (selectedCategory === 'Books') {
          const { results, hasMore } = await searchBooks(searchQuery, bookSearchType, 0);
          setSearchResults(results || []);
          setSearchHasMore(hasMore);
          setSearchOffset(results?.length ?? 0);
        } else {
          const { movies, totalPages } = await searchMovies(searchQuery, 1);
          setSearchResults(movies || []);
          setSearchHasMore(totalPages > 1);
          setSearchOffset(movies?.length ?? 0);
        }
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
        setSearchHasMore(false);
      } finally {
        setIsSearching(false);
      }
    };

    searchTimeoutRef.current = setTimeout(performSearch, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery, yearFilter, discoverSortBy, selectedCategory, musicSearchType, bookSearchType, movieSearchType, selectedPerson]);

  const loadMoreDiscover = useCallback(async () => {
    if (discoverPage >= discoverTotalPages || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = discoverPage + 1;
      const { movies, totalPages } = await discoverMovies({
        year: parseInt(yearFilter),
        sortBy: discoverSortBy,
        page: nextPage,
        theatricalOnly: true,
      });
      setSearchResults(prev => [...prev, ...(movies || [])]);
      setDiscoverPage(nextPage);
      setDiscoverTotalPages(totalPages);
    } catch (error) {
      console.error('Load more failed:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [discoverPage, discoverTotalPages, yearFilter, discoverSortBy, isLoadingMore]);

  const loadMoreSearch = useCallback(async () => {
    if (!searchHasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      if (selectedCategory === 'Games') {
        const { games, hasMore } = await searchGames(searchQuery, searchOffset);
        setSearchResults(prev => [...prev, ...(games || [])]);
        setSearchOffset(prev => prev + (games?.length ?? 0));
        setSearchHasMore(hasMore);
      } else if (selectedCategory === 'TV') {
        const nextPage = Math.floor(searchOffset / 20) + 1;
        const { shows, totalPages } = await searchTV(searchQuery, nextPage);
        setSearchResults(prev => [...prev, ...(shows || [])]);
        setSearchOffset(prev => prev + (shows?.length ?? 0));
        setSearchHasMore(nextPage < totalPages);
      } else if (selectedCategory === 'Music') {
        const { results, hasMore } = await searchMusic(searchQuery, musicSearchType, searchOffset);
        setSearchResults(prev => [...prev, ...(results || [])]);
        setSearchOffset(prev => prev + (results?.length ?? 0));
        setSearchHasMore(hasMore);
      } else if (selectedCategory === 'Books') {
        const { results, hasMore } = await searchBooks(searchQuery, bookSearchType, searchOffset);
        setSearchResults(prev => [...prev, ...(results || [])]);
        setSearchOffset(prev => prev + (results?.length ?? 0));
        setSearchHasMore(hasMore);
      } else {
        // Movies text search
        const nextPage = Math.floor(searchOffset / 20) + 1;
        const { movies, totalPages } = await searchMovies(searchQuery, nextPage);
        setSearchResults(prev => [...prev, ...(movies || [])]);
        setSearchOffset(prev => prev + (movies?.length ?? 0));
        setSearchHasMore(nextPage < totalPages);
      }
    } catch (error) {
      console.error('Load more search failed:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [searchHasMore, isLoadingMore, selectedCategory, searchQuery, searchOffset, musicSearchType, bookSearchType]);

  const handleSelectPerson = useCallback(async (person: any) => {
    setSelectedPerson({ id: person.id, name: person.name, profilePath: person.profile_path });
    setPersonResults([]);
    setSearchQuery('');
    setIsSearching(true);
    try {
      const { movies } = await getPersonMovies(person.id, movieSearchType === 'director' ? 'director' : 'cast');
      setSearchResults(movies || []);
    } catch (error) {
      console.error('Person movies failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [movieSearchType]);

  // ── Items state ───────────────────────────────────────────────────────────
  const [items, setItems] = useState<RankItem[]>([]);

  // ── Draft autosave ─────────────────────────────────────────────────────────
  // Persist in-progress new lists to localStorage so a refresh or browser
  // crash doesn't nuke the user's work. Only runs in "new list" mode — edit
  // mode is already round-tripped through the database.
  const DRAFT_KEY = 'createList:draft:v1';
  const draftHydrated = useRef(false);

  useEffect(() => {
    if (draftHydrated.current) return;
    // If we're entering edit mode or auto-importing, skip draft hydration.
    const state = location.state as { editList?: RankList; letterboxdUrl?: string } | null;
    if (state?.editList || state?.letterboxdUrl) {
      draftHydrated.current = true;
      return;
    }
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) { draftHydrated.current = true; return; }
      const draft = JSON.parse(raw) as {
        listTitle?: string;
        selectedCategory?: string;
        items?: RankItem[];
        tagsInput?: string;
        isCommunity?: boolean;
        savedAt?: number;
      };
      // Expire drafts older than 7 days.
      if (draft.savedAt && Date.now() - draft.savedAt > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(DRAFT_KEY);
        draftHydrated.current = true;
        return;
      }
      if (draft.listTitle) setListTitle(draft.listTitle);
      if (draft.selectedCategory) setSelectedCategory(draft.selectedCategory);
      if (draft.items && draft.items.length > 0) setItems(draft.items);
      if (draft.tagsInput) setTagsInput(draft.tagsInput);
      if (typeof draft.isCommunity === 'boolean') setIsCommunity(draft.isCommunity);
    } catch {
      // Corrupt draft — ignore and wipe it.
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    }
    draftHydrated.current = true;
  }, [location.state]);

  // Debounced save. Skip in edit mode — that path writes straight to the DB.
  useEffect(() => {
    if (!draftHydrated.current) return;
    if (editListId) return;
    // Nothing worth saving yet.
    if (!listTitle.trim() && items.length === 0) return;
    const timer = setTimeout(() => {
      try {
        // Don't persist in-flight blob: URLs — they'll be dead on reload.
        const safeItems = items.map(it => ({
          ...it,
          imageUrl: it.imageUrl && it.imageUrl.startsWith('blob:') ? null : it.imageUrl,
        }));
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          listTitle,
          selectedCategory,
          items: safeItems,
          tagsInput,
          isCommunity,
          savedAt: Date.now(),
        }));
      } catch {
        // Quota exceeded or unavailable — silently ignore.
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [listTitle, selectedCategory, items, tagsInput, isCommunity, editListId]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }, []);
  const [manualItemTitle, setManualItemTitle] = useState('');
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
  const [assigningItemId, setAssigningItemId] = useState<string | null>(null);

  const handleAddSearchResult = useCallback((result: any) => {
    if (addedSearchIds.has(result.id)) {
      setItems(prev => prev.filter(item => item.metadata?.searchResultId !== result.id));
      setAddedSearchIds(prev => { const next = new Set(prev); next.delete(result.id); return next; });
      return;
    }
    let rankItem;
    if (selectedCategory === 'Games') rankItem = igdbToRankItem(result);
    else if (selectedCategory === 'TV') rankItem = tmdbTVToRankItem(result);
    else if (selectedCategory === 'Music') rankItem = deezerToRankItem(result);
    else if (selectedCategory === 'Books') rankItem = googleBookToRankItem(result);
    else rankItem = tmdbToRankItem(result);

    const rankItemWithMeta = { ...rankItem, metadata: { ...(rankItem.metadata || {}), searchResultId: result.id } };
    setItems(prev => [...prev, rankItemWithMeta]);
    setAddedSearchIds(prev => new Set([...prev, result.id]));
  }, [selectedCategory, addedSearchIds]);

  const handleAddManualItem = useCallback(() => {
    if (!manualItemTitle.trim()) return;
    setItems(prev => [...prev, {
      id: `manual-${Date.now()}-${Math.random()}`,
      title: manualItemTitle.trim(),
      imageUrl: null,
      subtitle: undefined,
    }]);
    setManualItemTitle('');
  }, [manualItemTitle]);

  const handleAssignImage = useCallback((itemId: string, imageUrl: string) => {
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, imageUrl } : item));
    setAssigningItemId(null);
  }, []);

  const handleImageItemsCreated = useCallback((newItems: { id: string; title: string; imageUrl: string }[]) => {
    setItems(prev => [...prev, ...newItems.map(item => ({ ...item, imageUrl: item.imageUrl as string | null, subtitle: undefined }))]);
  }, []);

  const handleLibraryImageClick = useCallback((url: string) => {
    const img = libraryImages.find(i => i.url === url);
    if (!img) return;
    if (items.some(item => item.imageUrl === url)) return;
    setItems(prev => [...prev, {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: img.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase()),
      imageUrl: url,
      subtitle: undefined,
    }]);
  }, [libraryImages, items]);

  const handleRemoveItem = useCallback((id: string) => {
    setItems(prev => {
      const itemToRemove = prev.find(item => item.id === id);
      if (itemToRemove?.metadata?.searchResultId !== undefined) {
        const searchId = itemToRemove.metadata.searchResultId as string | number;
        setAddedSearchIds(prevIds => { const next = new Set(prevIds); next.delete(searchId); return next; });
      }
      return prev.filter(item => item.id !== id);
    });
  }, []);

  // ── CSV upload state ──────────────────────────────────────────────────────
  const [csvDragOver, setCsvDragOver] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvItemCount, setCsvItemCount] = useState<number | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = useCallback((text: string): RankItem[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];
    const firstLine = lines[0].toLowerCase().trim();
    const hasHeader = /^(title|name|item)/.test(firstLine);
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const parsed: RankItem[] = [];
    for (const line of dataLines) {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
        else current += ch;
      }
      fields.push(current.trim());
      const title = fields[0]?.replace(/^["']|["']$/g, '').trim();
      if (!title) continue;
      const subtitle = fields[1]?.replace(/^["']|["']$/g, '').trim() || undefined;
      const imageUrl = fields[2]?.replace(/^["']|["']$/g, '').trim() || null;
      parsed.push({
        id: `csv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title, imageUrl: imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) ? imageUrl : null, subtitle,
      });
    }
    return parsed;
  }, []);

  const handleCSVFile = useCallback((file: File) => {
    setCsvError(null); setCsvItemCount(null);
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.tsv') && !file.name.endsWith('.txt')) {
      setCsvError('Please upload a .csv, .tsv, or .txt file'); return;
    }
    if (file.size > 2 * 1024 * 1024) { setCsvError('File too large (max 2 MB)'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text?.trim()) { setCsvError('File is empty'); return; }
      const normalized = file.name.endsWith('.tsv') ? text.replace(/\t/g, ',') : text;
      const newItems = parseCSV(normalized);
      if (newItems.length === 0) { setCsvError('No valid items found in file'); return; }
      setItems(prev => [...prev, ...newItems]);
      setCsvItemCount(newItems.length);
      setTimeout(() => setCsvItemCount(null), 4000);
    };
    reader.onerror = () => setCsvError('Failed to read file');
    reader.readAsText(file);
  }, [parseCSV]);

  const handleCSVDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setCsvDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleCSVFile(file);
  }, [handleCSVFile]);

  const handleCSVInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleCSVFile(file);
    e.target.value = '';
  }, [handleCSVFile]);

  // ── Save / start ranking ──────────────────────────────────────────────────
  const handleStartRanking = async () => {
    if (items.length < 3) return;
    setSaveError(null);
    if (user) {
      setIsSaving(true);
      try {
        const tags = tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        const result = await saveList({ title: listTitle, category: selectedCategory, source: 'web', items, isCommunity, isPublic: true, tags });
        if ('error' in result) { setSaveError(result.error); return; }
        clearDraft();
        navigate('/ranking/custom', { state: { listId: result.listId, listTitle, category: selectedCategory, items } });
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Failed to save list');
      } finally {
        setIsSaving(false);
      }
    } else {
      navigate('/ranking/custom', { state: { listTitle, category: selectedCategory, items } });
    }
  };

  const handleSaveListOnly = async () => {
    if (!listTitle.trim() || items.length === 0) return;
    if (!user) { setSaveError('Sign in to save your list.'); return; }
    setSaveError(null); setIsSaving(true);
    try {
      const tags = tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      const result = await saveList({ title: listTitle, category: selectedCategory, source: 'web', items, isCommunity, isPublic: true, tags });
      if ('error' in result) { setSaveError(result.error); }
      else { clearDraft(); setSavedSuccess(true); setTimeout(() => setSavedSuccess(false), 4000); }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save list');
    } finally { setIsSaving(false); }
  };

  // Edit mode: overwrite the existing list in place
  const handleSaveChanges = async () => {
    if (!listTitle.trim() || items.length === 0 || !editListId) return;
    if (!user) { setSaveError('Sign in to save your list.'); return; }
    setSaveError(null); setIsSaving(true);
    try {
      const tags = tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      const result = await updateList(editListId, { title: listTitle, category: selectedCategory, items, isCommunity, tags });
      if (result.error) { setSaveError(result.error); }
      else { setSavedSuccess(true); setTimeout(() => setSavedSuccess(false), 4000); }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save changes');
    } finally { setIsSaving(false); }
  };

  // Edit mode: save as a brand-new list (keeps original untouched)
  const handleSaveAsNew = async () => {
    if (!listTitle.trim() || items.length === 0) return;
    if (!user) { setSaveError('Sign in to save your list.'); return; }
    setSaveError(null); setIsSaving(true);
    try {
      const tags = tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      const result = await saveList({ title: listTitle, category: selectedCategory, source: 'web', items, isCommunity, isPublic: true, tags });
      if ('error' in result) { setSaveError(result.error); }
      else {
        // Switch to editing the newly created list
        clearDraft();
        setEditListId(result.listId);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 4000);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save list');
    } finally { setIsSaving(false); }
  };

  // ── UI state ──────────────────────────────────────────────────────────────
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [importExpanded, setImportExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isSearchableCategory = ['Movies', 'TV', 'Games', 'Music', 'Books'].includes(selectedCategory);
  // Block save/start while any image is mid-upload — otherwise we'd persist dead blob: URLs.
  const isUploadingImages = libraryImages.some(img => img.status === 'uploading');
  const canStartRanking = items.length >= 3 && listTitle.trim() && !isUploadingImages;
  const canSave = items.length > 0 && listTitle.trim() && !!user && !isUploadingImages;

  const searchPlaceholder =
    selectedCategory === 'TV' ? 'Search TV shows...'
    : selectedCategory === 'Games' ? 'Search games...'
    : selectedCategory === 'Music'
      ? musicSearchType === 'album' ? 'Search albums...' : musicSearchType === 'artist' ? 'Search artists...' : 'Search songs...'
    : selectedCategory === 'Books' ? (bookSearchType === 'author' ? 'Search by author...' : 'Search books by title...')
    : selectedCategory === 'Movies' && movieSearchType === 'actor' ? 'Search actors...'
    : selectedCategory === 'Movies' && movieSearchType === 'director' ? 'Search directors...'
    : 'Search movies...';

  // ── Sidebar / tray shared content ─────────────────────────────────────────
  const ItemsPanel = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={`space-y-4 ${isMobile ? '' : ''}`}>
      {/* Items list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white/80">
            Items
            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-bold ${
              items.length >= 3 ? 'bg-violet-600/30 text-violet-300' : 'bg-white/[0.08] text-white/40'
            }`}>
              {items.length}
            </span>
          </h3>
          {items.length > 0 && items.length < 3 && (
            <span className="text-xs text-amber-400/80">Need {3 - items.length} more</span>
          )}
        </div>

        <div className={`space-y-1.5 ${isMobile ? 'max-h-56 overflow-y-auto' : 'max-h-72 overflow-y-auto'} pr-1`}
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
        >
          <AnimatePresence initial={false}>
            {items.length > 0 ? items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/[0.03] border border-white/[0.06] group hover:bg-white/[0.05] transition-colors">
                  <button
                    type="button"
                    onClick={() => setAssigningItemId(assigningItemId === item.id ? null : item.id)}
                    className="flex-shrink-0"
                    title={item.imageUrl ? 'Change image' : 'Add image'}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} className="w-8 h-8 rounded object-cover hover:ring-1 hover:ring-violet-400/50 transition-all" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.10] transition-colors">
                        <ImageIcon className="w-3.5 h-3.5 text-white/25" />
                      </div>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white/85 truncate font-medium">{item.title}</p>
                    {item.subtitle && <p className="text-xs text-white/35 truncate">{item.subtitle}</p>}
                  </div>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity p-0.5"
                  >
                    <X className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>

                {/* Inline image picker */}
                <AnimatePresence>
                  {assigningItemId === item.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-1"
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
            )) : (
              <div className="py-8 text-center">
                <p className="text-xs text-white/25">No items yet</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.06]" />

      {/* Tags */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-white/45">
          Tags <span className="text-white/25 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          placeholder="apex legends, characters, battle royale"
          value={tagsInput}
          onChange={e => setTagsInput(e.target.value)}
          style={{ fontSize: '16px' }}
          className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.05] border border-white/[0.08] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/15 transition-all"
        />
        <p className="text-xs text-white/25">Comma-separated. Helps others find your list.</p>
      </div>

      {/* Community toggle */}
      {user && (
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative flex-shrink-0">
            <input
              type="checkbox"
              checked={isCommunity}
              onChange={e => setIsCommunity(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 rounded-full bg-white/[0.08] border border-white/[0.12] peer-checked:bg-violet-600 peer-checked:border-violet-500 transition-all" />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white/40 peer-checked:translate-x-4 peer-checked:bg-white transition-all" />
          </div>
          <div>
            <p className="text-xs font-medium text-white/70 group-hover:text-white/90 transition-colors">Submit to Community</p>
            <p className="text-xs text-white/30">Share your list with others</p>
          </div>
        </label>
      )}

      {/* Feedback messages */}
      <AnimatePresence>
        {savedSuccess && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <p className="text-xs text-emerald-300">{editListId ? 'Changes saved!' : `List saved${isCommunity ? ' to community' : ''}! Check your dashboard.`}</p>
          </motion.div>
        )}
        {saveError && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{saveError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="space-y-2 pt-1">
        {editListId ? (
          // ── Edit mode ──────────────────────────────────────────────────────
          <>
            <button
              onClick={handleSaveChanges}
              disabled={!canSave || isSaving}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed ${
                canSave
                  ? 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-600/20'
                  : 'bg-white/[0.06] text-white/50 border border-white/[0.10]'
              }`}
            >
              {isSaving ? <><Spinner /> Saving...</> : <><Pencil className="w-4 h-4" /> Save Changes</>}
            </button>
            <button
              onClick={handleStartRanking}
              disabled={!canStartRanking || isSaving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/[0.05] text-white/60 border border-white/[0.08] hover:bg-white/[0.09] hover:text-white/80 transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? <Spinner /> : <>Start Ranking <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
            {user && (
              <button
                onClick={handleSaveAsNew}
                disabled={!canSave || isSaving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/[0.05] text-white/60 border border-white/[0.08] hover:bg-white/[0.09] hover:text-white/80 transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSaving ? <Spinner /> : <><Copy className="w-3.5 h-3.5" /> Save as New List</>}
              </button>
            )}
          </>
        ) : (
          // ── Create mode ────────────────────────────────────────────────────
          <>
            <button
              onClick={handleStartRanking}
              disabled={!canStartRanking || isSaving}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed ${
                canStartRanking
                  ? 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-600/20'
                  : 'bg-white/[0.06] text-white/50 border border-white/[0.10]'
              }`}
            >
              {isSaving ? <><Spinner /> Saving...</> : <>Save & Start Ranking <ArrowRight className="w-4 h-4" /></>}
            </button>
            {user && (
              <button
                onClick={handleSaveListOnly}
                disabled={!canSave || isSaving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/[0.05] text-white/60 border border-white/[0.08] hover:bg-white/[0.09] hover:text-white/80 transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSaving ? <Spinner /> : 'Save List Only'}
              </button>
            )}
          </>
        )}
        {!listTitle.trim() && items.length > 0 && (
          <p className="text-center text-[11px] text-amber-400/80 pt-0.5">
            Give your list a name to save it
          </p>
        )}
      </div>
    </div>
  );

  return (
    <PageLayout maxWidth="xl">
      {/* ── Sticky config bar ─────────────────────────────────────────────── */}
      <div className="sticky top-14 z-30 -mx-8 sm:-mx-12 px-6 sm:px-10 py-3 mb-6 bg-[#060610]/92 backdrop-blur-xl border-b border-white/[0.07]">
        <div className="max-w-6xl mx-auto space-y-3">
          {/* Title input */}
          <div className="relative group">
            <input
              type="text"
              placeholder="Name your list…"
              value={listTitle}
              onChange={e => setListTitle(e.target.value)}
              style={{ fontSize: '16px' }}
              className="w-full bg-transparent text-white/90 placeholder:text-white/40 font-semibold tracking-tight focus:outline-none border-0 text-lg pb-1.5"
            />
            <div className={`absolute bottom-0 left-0 right-0 h-px transition-all duration-200 ${
              listTitle.trim()
                ? 'bg-violet-500/60'
                : 'bg-white/20 group-focus-within:bg-violet-500/60'
            }`} />
            {!listTitle.trim() && (
              <span className="absolute right-0 bottom-2 text-[10px] font-medium text-amber-400/70 pointer-events-none">
                required
              </span>
            )}
          </div>

          {/* Category pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id); setSearchQuery(''); setYearFilter(''); setSearchResults([]); setPersonResults([]); setSelectedPerson(null); setMovieSearchType('title'); }}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/30'
                      : 'bg-white/[0.05] text-white/45 hover:text-white/70 hover:bg-white/[0.08] border border-white/[0.07]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main layout ───────────────────────────────────────────────────── */}
      <div className="lg:grid lg:grid-cols-[1fr_288px] lg:gap-8 xl:gap-10">

        {/* ── Left column: search + results + import ─────────────────────── */}
        <div className="space-y-5">

          {/* Music sub-type picker */}
          {selectedCategory === 'Music' && (
            <div className="flex gap-1.5">
              {(['track', 'album', 'artist'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => { setMusicSearchType(type); setSearchQuery(''); setSearchResults([]); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    musicSearchType === type
                      ? 'bg-violet-600 text-white'
                      : 'bg-white/[0.05] text-white/45 hover:text-white/70 hover:bg-white/[0.08] border border-white/[0.07]'
                  }`}
                >
                  {type === 'track' ? 'Songs' : type === 'album' ? 'Albums' : 'Artists'}
                </button>
              ))}
            </div>
          )}

          {/* Books sub-type picker */}
          {selectedCategory === 'Books' && (
            <div className="flex gap-1.5">
              {(['title', 'author'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => { setBookSearchType(type); setSearchQuery(''); setSearchResults([]); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    bookSearchType === type
                      ? 'bg-violet-600 text-white'
                      : 'bg-white/[0.05] text-white/45 hover:text-white/70 hover:bg-white/[0.08] border border-white/[0.07]'
                  }`}
                >
                  {type === 'title' ? 'Title' : 'Author'}
                </button>
              ))}
            </div>
          )}

          {/* Movies sub-type picker */}
          {selectedCategory === 'Movies' && (
            <div className="flex gap-1.5">
              {(['title', 'actor', 'director', 'year'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => {
                    if (type !== 'year') setYearFilter('');
                    setMovieSearchType(type);
                    setSearchQuery('');
                    setSearchResults([]);
                    setPersonResults([]);
                    setSelectedPerson(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    movieSearchType === type
                      ? 'bg-violet-600 text-white'
                      : 'bg-white/[0.05] text-white/45 hover:text-white/70 hover:bg-white/[0.08] border border-white/[0.07]'
                  }`}
                >
                  {type === 'title' ? 'Title' : type === 'actor' ? 'Actor' : type === 'director' ? 'Director' : 'Year'}
                </button>
              ))}
            </div>
          )}

          {/* Search bar */}
          {isSearchableCategory ? (
            <div className="space-y-2">
            {/* Year input — Movies year mode */}
            {selectedCategory === 'Movies' && movieSearchType === 'year' && (
              <div className="space-y-1.5">
                <div className="relative flex items-center">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                  <input
                    type="number"
                    min="1888"
                    max={new Date().getFullYear() + 2}
                    placeholder="Enter a year, e.g. 2025"
                    value={yearFilter}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setYearFilter(val);
                      if (val.length !== 4) { setDiscoverPage(1); setDiscoverTotalPages(1); }
                    }}
                    style={{ fontSize: '16px' }}
                    className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-white/[0.06] border border-white/[0.10] text-white/90 placeholder:text-white/25 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/12 hover:border-white/[0.16] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {yearFilter && (
                    <button
                      onClick={() => { setYearFilter(''); setDiscoverPage(1); setDiscoverTotalPages(1); setSearchResults([]); }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {yearFilter.length === 4 && (
                  <p className="text-xs text-white/30 pl-1">Showing theatrical releases only</p>
                )}
              </div>
            )}
            {/* Selected person chip + text search — hidden in year mode */}
            {!(selectedCategory === 'Movies' && movieSearchType === 'year') && (<>
            {selectedPerson && (
              <div className="flex items-center gap-2">
                {selectedPerson.profilePath && (
                  <img
                    src={`https://image.tmdb.org/t/p/w185${selectedPerson.profilePath}`}
                    alt={selectedPerson.name}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                )}
                <span className="text-sm font-semibold text-white/90">{selectedPerson.name}</span>
                <button
                  onClick={() => { setSelectedPerson(null); setSearchResults([]); setSearchQuery(''); }}
                  className="ml-auto text-white/30 hover:text-white/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {!selectedPerson && (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
              {isSearching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Spinner className="h-4 w-4 text-white/30" />
                </div>
              )}
              {searchQuery && !isSearching && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <input
                ref={searchInputRef}
                type="text"
                inputMode="search"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ fontSize: '16px' }}
                className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-white/[0.06] border border-white/[0.10] text-white/90 placeholder:text-white/25 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/12 hover:border-white/[0.16] transition-all"
              />
            </div>
            )}
            </>)}
            </div>
          ) : (
            /* Manual add as primary for Custom/Food */
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <Plus className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Type an item and press Enter…"
                  value={manualItemTitle}
                  onChange={e => setManualItemTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddManualItem()}
                  style={{ fontSize: '16px' }}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/[0.06] border border-white/[0.10] text-white/90 placeholder:text-white/25 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/12 hover:border-white/[0.16] transition-all"
                />
              </div>
              <button
                onClick={handleAddManualItem}
                disabled={!manualItemTitle.trim()}
                className="flex-shrink-0 px-4 py-3.5 rounded-2xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
              >
                Add
              </button>
            </div>
          )}

          {/* Sort controls — shown in year mode or when a person filmography is loaded */}
          {selectedCategory === 'Movies' && (
            (movieSearchType === 'year' && yearFilter.length === 4) ||
            selectedPerson
          ) && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-white/35 font-medium shrink-0">Sort by</span>
              {(
                [
                  { value: 'release_date.asc', label: 'Date ↑' },
                  { value: 'release_date.desc', label: 'Date ↓' },
                  { value: 'title.asc', label: 'Title A–Z' },
                  { value: 'title.desc', label: 'Title Z–A' },
                ] as const
              ).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (discoverSortBy !== opt.value) {
                      setDiscoverSortBy(opt.value);
                      // Year-browse (no text query, no person): refetch from server with new sort
                      if (!searchQuery && !selectedPerson) {
                        setDiscoverPage(1);
                        setDiscoverTotalPages(1);
                        setSearchResults([]);
                      }
                      // Person mode & text-search mode: sorted client-side, no refetch needed
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    discoverSortBy === opt.value
                      ? 'bg-violet-600/80 text-white'
                      : 'bg-white/[0.06] text-white/50 hover:bg-white/[0.10] hover:text-white/80'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Person search results */}
          <AnimatePresence mode="wait">
            {personResults.length > 0 && (
              <motion.div
                key="person-results"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"
              >
                {personResults.slice(0, 6).map(person => (
                  <button
                    key={person.id}
                    onClick={() => handleSelectPerson(person)}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] hover:border-white/[0.15] transition-all text-left"
                  >
                    {person.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                        alt={person.name}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                        <span className="text-white/30 text-lg font-bold">{person.name[0]}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white/90 truncate">{person.name}</p>
                      <p className="text-xs text-white/35 truncate">{person.known_for_department}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search results grid */}
          <AnimatePresence mode="wait">
            {isSearchableCategory && (searchQuery || (yearFilter.length === 4 && selectedCategory === 'Movies') || selectedPerson) && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
              >
                {isSearching && searchResults.length === 0 ? (
                  <div className="py-12 flex items-center justify-center gap-2 text-white/30 text-sm">
                    <Spinner /> Searching…
                  </div>
                ) : searchResults.length === 0 && !isSearching ? (
                  <div className="py-12 text-center text-white/25 text-sm">No results found</div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                    {(selectedCategory === 'Movies' && (selectedPerson || (searchQuery && yearFilter.length === 4))
                      ? [...searchResults].sort((a, b) => {
                          if (discoverSortBy === 'title.asc') return (a.title || '').localeCompare(b.title || '');
                          if (discoverSortBy === 'title.desc') return (b.title || '').localeCompare(a.title || '');
                          if (discoverSortBy === 'release_date.desc') return (b.release_date || '').localeCompare(a.release_date || '');
                          return (a.release_date || '').localeCompare(b.release_date || ''); // release_date.asc default
                        })
                      : searchResults
                    ).map(result => {
                      const isGame = selectedCategory === 'Games';
                      const isMusic = selectedCategory === 'Music';
                      const isBook = selectedCategory === 'Books';
                      const displayTitle = isMusic ? result.title : isGame ? result.name : (result.title || result.name);
                      const displaySub = isMusic ? result.artist
                        : isGame ? result.releaseDate
                        : isBook ? [result.author, result.year].filter(Boolean).join(' · ')
                        : (result.release_date || result.first_air_date)?.slice(0, 4);
                      const imageUrl = isMusic ? result.imageUrl
                        : isGame ? result.cover
                        : isBook ? result.imageUrl
                        : result.poster_path ? `https://image.tmdb.org/t/p/w200${result.poster_path}` : null;
                      const isAdded = addedSearchIds.has(result.id);

                      return (
                        <button
                          key={result.id}
                          onClick={() => handleAddSearchResult(result)}
                          className="group relative text-left focus:outline-none"
                        >
                          <div className={`relative overflow-hidden rounded-xl ${isMusic ? 'aspect-square' : 'aspect-[2/3]'}`}>
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={displayTitle}
                                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full bg-white/[0.05] flex items-center justify-center">
                                {isMusic ? <Music className="w-6 h-6 text-white/20" />
                                  : isGame ? <Gamepad2 className="w-6 h-6 text-white/20" />
                                  : isBook ? <BookMarked className="w-6 h-6 text-white/20" />
                                  : <Film className="w-6 h-6 text-white/20" />}
                              </div>
                            )}

                            {/* Overlay */}
                            {isAdded ? (
                              <div className="absolute inset-0 bg-emerald-500/35 group-hover:bg-red-500/40 transition-colors flex items-center justify-center">
                                <div className="w-7 h-7 rounded-full bg-emerald-500 group-hover:bg-red-500 transition-colors flex items-center justify-center shadow-lg">
                                  <svg className="w-4 h-4 text-white group-hover:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                  <X className="w-4 h-4 text-white hidden group-hover:block" />
                                </div>
                              </div>
                            ) : (
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full bg-white/0 group-hover:bg-white/15 transition-all flex items-center justify-center scale-75 group-hover:scale-100">
                                  <Plus className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            )}

                            {/* Title gradient */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-6">
                              <p className="text-xs text-white font-semibold line-clamp-2 leading-tight">{displayTitle}</p>
                              {displaySub && <p className="text-xs text-white/45 mt-0.5">{displaySub}</p>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Load More — year-browse discover mode */}
          {!searchQuery && yearFilter.length === 4 && selectedCategory === 'Movies' && searchResults.length > 0 && discoverPage < discoverTotalPages && (
            <button
              onClick={loadMoreDiscover}
              disabled={isLoadingMore}
              className="w-full py-3 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.08] text-sm font-medium transition-all disabled:opacity-40"
            >
              {isLoadingMore ? 'Loading…' : `Load more ${yearFilter} releases`}
            </button>
          )}

          {/* Load more — text search across all categories */}
          {searchQuery && searchHasMore && searchResults.length > 0 && (
            <button
              onClick={loadMoreSearch}
              disabled={isLoadingMore}
              className="w-full py-3 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.08] text-sm font-medium transition-all disabled:opacity-40"
            >
              {isLoadingMore ? 'Loading…' : 'Load more results'}
            </button>
          )}

          {/* Empty search state for searchable categories */}
          {isSearchableCategory && !searchQuery && !selectedPerson && !(yearFilter.length === 4 && selectedCategory === 'Movies') && (
            <div className="py-10 text-center space-y-2">
              <Search className="w-8 h-8 text-white/10 mx-auto" />
              <p className="text-sm text-white/25">Search above to find {selectedCategory === 'TV' ? 'TV shows' : selectedCategory.toLowerCase()} to add{selectedCategory === 'Movies' ? ', or switch to Year to browse by release date' : ''}</p>
            </div>
          )}

          {/* ── More ways to add ─────────────────────────────────────────── */}
          <div className="border border-white/[0.07] rounded-2xl overflow-hidden">
            <button
              onClick={() => setImportExpanded(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-white/50 hover:text-white/75 hover:bg-white/[0.03] transition-colors"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                More ways to add
              </span>
              <motion.div animate={{ rotate: importExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </button>

            <AnimatePresence>
              {importExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 space-y-6 border-t border-white/[0.07] pt-5">

                    {/* Manual add (only shown in expanded for searchable categories) */}
                    {isSearchableCategory && (
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-white/45 uppercase tracking-wider">Add manually</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Type an item title…"
                            value={manualItemTitle}
                            onChange={e => setManualItemTitle(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddManualItem()}
                            style={{ fontSize: '16px' }}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.09] text-white/85 placeholder:text-white/22 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/12 transition-all text-sm"
                          />
                          <button
                            onClick={handleAddManualItem}
                            disabled={!manualItemTitle.trim()}
                            className="px-4 py-2.5 rounded-xl bg-white/[0.07] border border-white/[0.10] text-white/70 text-sm font-semibold hover:bg-white/[0.11] hover:text-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Letterboxd */}
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-white/45 uppercase tracking-wider">Import from Letterboxd</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="url"
                          placeholder="letterboxd.com/username/list/…"
                          value={letterboxdUrl}
                          onChange={e => { setLetterboxdUrl(e.target.value); setLetterboxdValidation('idle'); setLetterboxdError(null); }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              if (isValidLetterboxdUrl(letterboxdUrl)) handleLetterboxdImport();
                              else setLetterboxdValidation('invalid');
                            }
                          }}
                          disabled={letterboxdImporting}
                          style={{ fontSize: '16px' }}
                          className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.09] text-white/85 placeholder:text-white/22 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/12 transition-all text-sm disabled:opacity-50"
                        />
                        <button
                          onClick={() => { if (isValidLetterboxdUrl(letterboxdUrl)) handleLetterboxdImport(); else setLetterboxdValidation('invalid'); }}
                          disabled={!letterboxdUrl.trim() || letterboxdImporting}
                          className="flex-shrink-0 w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600/20 border border-violet-500/25 text-violet-300 text-sm font-semibold hover:bg-violet-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
                        >
                          {letterboxdImporting ? <><Spinner /> Importing…</> : <><Import className="w-3.5 h-3.5" /> Import</>}
                        </button>
                      </div>
                      <AnimatePresence>
                        {letterboxdValidation === 'invalid' && (
                          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="text-xs text-red-400 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" /> Invalid URL. Use a public Letterboxd list, watchlist, or films URL.
                          </motion.p>
                        )}
                        {letterboxdError && (
                          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="text-xs text-red-400 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" /> {letterboxdError}
                          </motion.p>
                        )}
                        {letterboxdSuccess !== null && (
                          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="text-xs text-emerald-400">
                            Imported {letterboxdSuccess} {letterboxdSuccess === 1 ? 'film' : 'films'} from Letterboxd
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* CSV Upload */}
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-white/45 uppercase tracking-wider">Import CSV</label>
                      <div
                        onDragOver={(e) => { e.preventDefault(); setCsvDragOver(true); }}
                        onDragLeave={() => setCsvDragOver(false)}
                        onDrop={handleCSVDrop}
                        onClick={() => csvInputRef.current?.click()}
                        className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                          csvDragOver
                            ? 'border-violet-400/50 bg-violet-500/8'
                            : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]'
                        }`}
                      >
                        <Upload className={`w-4 h-4 flex-shrink-0 ${csvDragOver ? 'text-violet-400' : 'text-white/25'}`} />
                        <div>
                          <p className="text-sm text-white/45">{csvDragOver ? 'Drop to import' : 'Drag a CSV or click to browse'}</p>
                          <p className="text-xs text-white/22 mt-0.5">Columns: title, subtitle (opt), image URL (opt)</p>
                        </div>
                        <input ref={csvInputRef} type="file" accept=".csv,.tsv,.txt" onChange={handleCSVInputChange} className="hidden" />
                      </div>
                      <AnimatePresence>
                        {csvError && (
                          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="text-xs text-red-400 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" /> {csvError}
                          </motion.p>
                        )}
                        {csvItemCount !== null && (
                          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="text-xs text-emerald-400">
                            Added {csvItemCount} {csvItemCount === 1 ? 'item' : 'items'} from CSV
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Image Library */}
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-white/45 uppercase tracking-wider">Image Library</label>
                      <p className="text-xs text-white/30">
                        Upload images to auto-create items. Click any unused image to add it.
                      </p>
                      <ImageLibrary
                        images={libraryImages}
                        onImagesChange={setLibraryImages}
                        onSelectImage={handleLibraryImageClick}
                        onItemsCreated={handleImageItemsCreated}
                        inUseUrls={new Set(items.map(i => i.imageUrl).filter((u): u is string => Boolean(u)))}
                      />
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* ── Right column: items panel ──────────────────────────────────── */}
        <div className="hidden lg:block mt-8 lg:mt-0">
          <div className="sticky top-36">
            <ItemsPanel />
          </div>
        </div>

      </div>

      {/* ── Mobile items panel (collapsible tray) ─────────────────────────── */}
      <div className="lg:hidden mt-6 border border-white/[0.07] rounded-2xl overflow-hidden">
        <button
          onClick={() => setIsTrayOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-white/60 hover:text-white/80 hover:bg-white/[0.03] transition-colors"
        >
          <span className="flex items-center gap-2">
            <List className="w-4 h-4" />
            Items
            <span className={`ml-1 px-1.5 py-0.5 rounded text-xs font-bold ${
              items.length >= 3 ? 'bg-violet-600/30 text-violet-300' : 'bg-white/[0.08] text-white/40'
            }`}>{items.length}</span>
          </span>
          <motion.div animate={{ rotate: isTrayOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </button>
        <AnimatePresence>
          {isTrayOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto",  opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-white/[0.07]"
            >
              <div className="p-5">
                <ItemsPanel isMobile />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </PageLayout>
  );
}
