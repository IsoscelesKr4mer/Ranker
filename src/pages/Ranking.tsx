import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, ProgressBar } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { useRanking } from '@/hooks/useRanking';
import { getPresetById } from '@/data/presets';
import { importLetterboxdList } from '@/lib/letterboxd';
import { searchMovies } from '@/lib/tmdb';
import { saveRankingSession, updateRankingSession, completeRankingSession, saveList, getListById, getRankingSessionById } from '@/lib/database';
import { useAuthStore } from '@/store/authStore';
import type { RankItem, MergeSortState } from '@/types';
import { Undo2, X, ArrowLeft, Trophy, Search, Play, Save } from 'lucide-react';

// ─── Guest session helpers (localStorage) ──────────────────────────
interface GuestSession {
  listTitle: string;
  category: string;
  source: 'preset' | 'custom' | 'letterboxd';
  items: RankItem[];
  sortState: MergeSortState;
  comparisonsMade: number;
  savedAt: string;
  presetId?: string;
}

function guestSessionKey(presetId?: string, listTitle?: string): string {
  const id = presetId || (listTitle ? btoa(encodeURIComponent(listTitle)).slice(0, 24) : 'custom');
  return `ranker_guest_session_${id}`;
}

function loadGuestSession(presetId?: string, listTitle?: string): GuestSession | null {
  try {
    const raw = localStorage.getItem(guestSessionKey(presetId, listTitle));
    return raw ? (JSON.parse(raw) as GuestSession) : null;
  } catch { return null; }
}

function saveGuestSession(session: GuestSession, presetId?: string): void {
  try {
    localStorage.setItem(guestSessionKey(presetId, session.listTitle), JSON.stringify(session));
  } catch { /* storage full or unavailable */ }
}

function clearGuestSession(presetId?: string, listTitle?: string): void {
  try {
    localStorage.removeItem(guestSessionKey(presetId, listTitle));
  } catch { /* ignore */ }
}

// Prompt rotation system based on category
const COMPARISON_PROMPTS: Record<string, string[]> = {
  movies: [
    "Movie night — which one are you putting on?",
    "You can only watch one ever again. Which?",
    "One gets pulled from existence. Which do you save?",
    "Which would you actually rewatch?",
    "Which one hits harder?",
  ],
  tv: [
    "Binge night — which show are you picking?",
    "You can only finish one series. Which?",
    "Which one do you actually look forward to?",
    "One gets cancelled forever. Which do you keep?",
    "Which would you recommend without hesitation?",
  ],
  games: [
    "One game left on your shelf. Which stays?",
    "You can only play one ever again. Which?",
    "Which one do you boot up when you just want to play?",
    "Which kept you hooked longer?",
    "One gets deleted from existence. Which do you save?",
  ],
  music: [
    "Road trip — which gets the aux?",
    "You can only listen to one forever. Which?",
    "Which one actually slaps?",
    "Desert island pick. Which?",
    "Which do you keep coming back to?",
  ],
  books: [
    "You can only reread one. Which?",
    "Which one stuck with you longer?",
    "One gets pulled from shelves forever. Which do you save?",
    "Which would you recommend to someone you care about?",
    "Which left a bigger impression?",
  ],
  food: [
    "Last meal — which one?",
    "You can only eat one of these forever. Which?",
    "Which are you actually craving right now?",
    "Which do you go back to more?",
    "Be honest — which is better?",
  ],
  default: [
    "You can only keep one. Which survives?",
    "Be honest — which is actually better?",
    "Which left a bigger impression on you?",
    "No hesitation. Which one?",
    "Which would you defend in an argument?",
    "One gets erased forever. Which do you save?",
    "Which do you find yourself coming back to?",
    "Desert island — one choice only. Which?",
  ],
};

interface RankingState {
  listTitle: string;
  category: string;
  items: RankItem[];
  source: 'preset' | 'custom' | 'letterboxd';
}

export default function Ranking() {
  const navigate = useNavigate();
  const location = useLocation();
  const { presetId, sessionId: resumeSessionId } = useParams<{ presetId?: string; sessionId?: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();

  const {
    comparison,
    progress,
    result,
    isAnimating,
    canUndo,
    sortState,
    startRanking,
    resumeRanking,
    makeChoice,
    undoChoice,
    removeFromRanking,
  } = useRanking();

  const [rankingState, setRankingState] = useState<RankingState | null>(null);
  const [promptIndex, setPromptIndex] = useState(0);
  const [showBackDialog, setShowBackDialog] = useState(false);
  const [selectedCard, setSelectedCard] = useState<'left' | 'right' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [guestSavedSession, setGuestSavedSession] = useState<GuestSession | null>(null);
  const [isSavingAndExiting, setIsSavingAndExiting] = useState(false);
  const sessionCreated = useRef(false);
  const lastChosenSideRef = useRef<'left' | 'right' | null>(null);
  const [shownMilestone, setShownMilestone] = useState<number | null>(null);
  const [showMilestone, setShowMilestone] = useState(false);

  // Review mode state
  const [reviewMode, setReviewMode] = useState(true);
  const [reviewItems, setReviewItems] = useState<RankItem[]>([]);
  const [reviewSearch, setReviewSearch] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Enhance Letterboxd items with TMDb poster images
  const enhanceWithTmdb = async (items: RankItem[]): Promise<RankItem[]> => {
    const enhanced = await Promise.all(
      items.map(async (item) => {
        try {
          const { movies } = await searchMovies(item.title);
          if (movies.length > 0) {
            const match = movies[0];
            const posterUrl = match.poster_path
              ? `https://image.tmdb.org/t/p/w500${match.poster_path}`
              : null;
            return {
              ...item,
              imageUrl: posterUrl || item.imageUrl,
              subtitle: match.release_date ? match.release_date.slice(0, 4) : item.subtitle,
              metadata: {
                ...item.metadata,
                tmdbId: match.id,
                overview: match.overview,
              },
            };
          }
        } catch { /* keep original */ }
        return item;
      })
    );
    return enhanced;
  };

  // Initialize ranking based on route
  useEffect(() => {
    const initializeRanking = async () => {
      setIsLoading(true);
      let items: RankItem[] = [];
      let title = '';
      let category = 'default';
      let source: 'preset' | 'custom' | 'letterboxd' = 'custom';

      // ── Resume from a saved session (auth users via /rank/:sessionId/resume) ──
      if (resumeSessionId) {
        const session = await getRankingSessionById(resumeSessionId);
        if (session && session.status === 'in_progress') {
          const newRankingState: RankingState = {
            listTitle: session.listTitle,
            category: 'default',
            items: session.items,
            source: 'custom',
          };
          setRankingState(newRankingState);
          setCurrentSessionId(resumeSessionId);
          resumeRanking(session.sortState);
          setReviewMode(false);
          setIsLoading(false);
          return;
        } else {
          navigate('/dashboard');
          return;
        }
      }

      if (presetId) {
        const preset = getPresetById(presetId);
        if (preset) {
          items = preset.items;
          title = preset.title;
          category = preset.category.toLowerCase();
          source = 'preset';
        } else {
          // Try fetching from database (community lists)
          const dbList = await getListById(presetId);
          if (dbList) {
            items = dbList.items;
            title = dbList.title;
            category = dbList.category.toLowerCase();
            source = 'preset';
          } else {
            navigate('/');
            return;
          }
        }
      } else if (searchParams.get('url')) {
        source = 'letterboxd';
        try {
          const letterboxdUrl = searchParams.get('url')!;
          const imported = await importLetterboxdList(letterboxdUrl);
          if (imported.length === 0) {
            setImportError('No films found. Make sure the list is public and the URL is correct.');
            setIsLoading(false);
            return;
          }
          // Try to enhance items with TMDb posters for better image quality
          const enhanced = await enhanceWithTmdb(imported);
          items = enhanced;
          title = searchParams.get('listTitle') || 'Letterboxd Import';
          category = 'movies';

          // Save as community list if requested
          if (searchParams.get('saveList') === 'true') {
            saveList({
              title,
              category: 'Movies',
              source: 'letterboxd',
              items: enhanced,
              isPublic: true,
              isCommunity: true,
              coverImageUrl: enhanced[0]?.imageUrl || undefined,
            }).then(result => {
              if ('error' in result) {
                console.error('Failed to save community list:', result.error);
              } else {
                console.log('Community list saved:', result.listId);
              }
            }).catch(err => console.error('Failed to save list:', err));
          }
        } catch (err) {
          console.error('Letterboxd import failed:', err);
          setImportError('Failed to import from Letterboxd. Please check the URL and try again.');
          setIsLoading(false);
          return;
        }
      } else if (location.state?.items) {
        items = location.state.items;
        title = location.state.listTitle || 'Custom List';
        category = location.state.category || 'default';
        source = 'custom';
      }

      if (items.length > 0) {
        const newRankingState: RankingState = {
          listTitle: title,
          category,
          items,
          source,
        };
        setRankingState(newRankingState);
        setReviewItems([...items]);
        setReviewMode(true);

        // Check for a guest saved session for this list
        if (!user) {
          const saved = loadGuestSession(presetId, title);
          if (saved) {
            setGuestSavedSession(saved);
          }
        }
      }
      setIsLoading(false);
    };

    initializeRanking();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeSessionId, presetId, searchParams, location.state, navigate]);

  // Rotate prompt every 3-4 comparisons
  useEffect(() => {
    if (progress) {
      const newPromptIndex = Math.floor(progress.comparisons / 3);
      setPromptIndex(newPromptIndex);
    }
  }, [progress]);

  // Auto-save session after every 5 comparisons
  useEffect(() => {
    const autoSave = async () => {
      if (!sortState || !progress || progress.comparisons === 0 || progress.comparisons % 5 !== 0) return;

      if (user && currentSessionId) {
        // Authenticated: persist to Supabase
        await updateRankingSession(currentSessionId, {
          sortState,
          comparisonsMade: progress.comparisons,
        });
      } else if (!user && rankingState) {
        // Guest: persist to localStorage
        saveGuestSession({
          listTitle: rankingState.listTitle,
          category: rankingState.category,
          source: rankingState.source,
          items: rankingState.items,
          sortState,
          comparisonsMade: progress.comparisons,
          savedAt: new Date().toISOString(),
          presetId,
        }, presetId);
      }
    };

    autoSave();
  }, [user, currentSessionId, sortState, progress, rankingState, presetId]);

  // Create a Supabase session the first time sortState is populated after starting ranking.
  // We do this in a useEffect because startRanking calls setSortState, which is async —
  // sortState is still null in handleStartFromReview right after the call.
  useEffect(() => {
    const createSession = async () => {
      if (
        !user ||
        !sortState ||
        !rankingState ||
        reviewMode ||           // still on review screen — not started yet
        currentSessionId ||     // session already exists (e.g. resuming)
        sessionCreated.current  // guard against double-fire
      ) return;

      sessionCreated.current = true;
      const saveResult = await saveRankingSession({
        listId: location.state?.listId,
        listTitle: rankingState.listTitle,
        items: rankingState.items,
        sortState,
        comparisonsMade: 0,
        estimatedTotal: rankingState.items.length,
      });
      if ('sessionId' in saveResult) {
        setCurrentSessionId(saveResult.sessionId);
      }
    };
    createSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sortState, rankingState, reviewMode, currentSessionId]);

  // Handle completion
  useEffect(() => {
    const handleCompletion = async () => {
      if (result && rankingState) {
        if (user && currentSessionId) {
          await completeRankingSession(currentSessionId);
        }
        // Clear any guest session for this list on completion
        if (!user) {
          clearGuestSession(presetId, rankingState.listTitle);
        }

        navigate('/results', {
          state: {
            result,
            listTitle: rankingState.listTitle,
            comparisons: progress?.comparisons || 0,
            source: rankingState.source,
            sessionId: currentSessionId,
          },
        });
      }
    };

    handleCompletion();
  }, [result, rankingState, navigate, progress, user, currentSessionId, presetId]);

  const handleCardChoice = useCallback(
    (side: 'left' | 'right') => {
      if (isAnimating) return;
      lastChosenSideRef.current = side;
      setSelectedCard(side);
      makeChoice(side);
    },
    [isAnimating, makeChoice]
  );

  const handleRemove = useCallback(
    (itemId: string) => {
      removeFromRanking(itemId);
    },
    [removeFromRanking]
  );

  const handleUndo = useCallback(() => {
    if (!isAnimating && canUndo) {
      undoChoice();
    }
  }, [isAnimating, canUndo, undoChoice]);

  const handleBack = useCallback(() => {
    if (reviewMode) {
      navigate(-1);
      return;
    }
    if (progress && progress.comparisons > 0) {
      setShowBackDialog(true);
    } else {
      navigate(-1);
    }
  }, [progress, navigate, reviewMode]);

  const handleResumeGuestSession = useCallback(() => {
    if (!guestSavedSession) return;
    const newRankingState: RankingState = {
      listTitle: guestSavedSession.listTitle,
      category: guestSavedSession.category,
      items: guestSavedSession.items,
      source: guestSavedSession.source,
    };
    setRankingState(newRankingState);
    resumeRanking(guestSavedSession.sortState);
    setReviewMode(false);
    setGuestSavedSession(null);
  }, [guestSavedSession, resumeRanking]);

  const handleStartFromReview = useCallback(async () => {
    if (reviewItems.length < 2) return;

    // Clear any guest saved session since we're starting fresh
    if (!user && rankingState) {
      clearGuestSession(presetId, rankingState.listTitle);
      setGuestSavedSession(null);
    }

    // Update ranking state with pruned items
    setRankingState(prev => prev ? { ...prev, items: reviewItems } : null);
    startRanking(reviewItems);
    setReviewMode(false);
    // Session creation for auth users is handled by a useEffect that fires
    // once sortState is actually populated (React state updates are async, so
    // sortState is still null here even though startRanking just called setSortState).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewItems, startRanking, user, rankingState, presetId]);

  const handleSaveAndExit = useCallback(async () => {
    if (isSavingAndExiting) return;
    setIsSavingAndExiting(true);

    if (user && currentSessionId && sortState && progress) {
      await updateRankingSession(currentSessionId, {
        sortState,
        comparisonsMade: progress.comparisons,
      });
      navigate('/dashboard');
    } else if (!user && sortState && rankingState && progress) {
      saveGuestSession({
        listTitle: rankingState.listTitle,
        category: rankingState.category,
        source: rankingState.source,
        items: rankingState.items,
        sortState,
        comparisonsMade: progress.comparisons,
        savedAt: new Date().toISOString(),
        presetId,
      }, presetId);
      navigate('/');
    } else {
      navigate(-1);
    }

    setIsSavingAndExiting(false);
    setShowBackDialog(false);
  }, [isSavingAndExiting, user, currentSessionId, sortState, progress, rankingState, navigate, presetId]);

  const handleReviewRemove = useCallback((id: string) => {
    setReviewItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // Clear selectedCard when comparison advances
  useEffect(() => {
    setSelectedCard(null);
  }, [comparison]);

  // Keyboard shortcuts: ← → to choose, Z to undo
  useEffect(() => {
    if (reviewMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!comparison) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') handleCardChoice('left');
      else if (e.key === 'ArrowRight') handleCardChoice('right');
      else if ((e.key === 'z' || e.key === 'Z') && !e.metaKey && !e.ctrlKey) handleUndo();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reviewMode, comparison, handleCardChoice, handleUndo]);

  // Milestone celebrations at 25%, 50%, 75%
  useEffect(() => {
    if (!progress) return;
    const pct = Math.round(progress.progress * 100);
    for (const m of [25, 50, 75]) {
      if (pct >= m && (shownMilestone === null || m > shownMilestone)) {
        setShownMilestone(m);
        setShowMilestone(true);
        setTimeout(() => setShowMilestone(false), 2500);
        break;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress?.progress]);

  const currentPrompt = useMemo(() => {
    if (!rankingState) return 'Which do you prefer?';
    const prompts =
      COMPARISON_PROMPTS[rankingState.category.toLowerCase()] ??
      COMPARISON_PROMPTS['default']!;
    return prompts[promptIndex % prompts.length];
  }, [rankingState, promptIndex]);

  if (importError) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="mb-4 flex justify-center">
            <div className="w-10 h-10 rounded-xl bg-red-600/30 flex items-center justify-center text-red-400 text-lg">!</div>
          </div>
          <p className="text-white/70 text-base">{importError}</p>
          <Button variant="secondary" onClick={() => navigate('/browse')}>
            Back to Browse
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="w-10 h-10 rounded-xl bg-violet-600/30 animate-pulse" />
          </div>
          <p className="text-white/55 text-base">
            {searchParams.get('url')
              ? 'Importing your Letterboxd list...'
              : 'Loading your ranking...'}
          </p>
        </div>
      </div>
    );
  }

  if (!rankingState || rankingState.items.length === 0) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-white/55">No items to rank</p>
          <Button onClick={() => navigate('/')} className="mt-4" variant="primary">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Review mode — show all items before ranking starts
  if (reviewMode && rankingState) {
    const filteredReviewItems = reviewSearch.trim()
      ? reviewItems.filter(item =>
          item.title.toLowerCase().includes(reviewSearch.toLowerCase()) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(reviewSearch.toLowerCase()))
        )
      : reviewItems;

    return (
      <div className="min-h-screen bg-bg-primary flex flex-col pb-6 sm:pb-8 px-8 sm:px-12">
        {/* Top Bar */}
        <div className="flex items-center justify-between py-4 sm:py-5 border-b border-white/[0.07]">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 rounded-lg text-white/50 hover:text-white/85 hover:bg-white/[0.07] transition-colors touch-target"
            aria-label="Go back"
          >
            <ArrowLeft size={19} />
          </button>

          <div className="text-center flex-1 px-4">
            <h1
              className="text-sm sm:text-base font-bold text-white/88 truncate tracking-tight"
              style={{ fontFamily: 'var(--font-family-display)' }}
            >
              {rankingState.listTitle}
            </h1>
          </div>

          <div className="w-8" />
        </div>

        {/* Review Content */}
        <div className="flex-1 flex flex-col items-center pt-8 sm:pt-12">
          <div className="w-full max-w-lg space-y-6">
            {/* Header */}
            {/* Guest session resume banner */}
            {guestSavedSession && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-violet-600/10 border border-violet-500/25"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/90">You have saved progress</p>
                  <p className="text-xs text-white/50 mt-0.5">
                    {guestSavedSession.comparisonsMade} comparisons made · saved {new Date(guestSavedSession.savedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setGuestSavedSession(null)}
                    className="px-2.5 py-1.5 rounded-lg text-white/40 hover:text-white/65 text-xs transition-colors"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={handleResumeGuestSession}
                    className="px-3 py-1.5 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 text-xs font-medium transition-colors"
                  >
                    Resume →
                  </button>
                </div>
              </motion.div>
            )}

            <div className="text-center space-y-2">
              <h2
                className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
                style={{ fontFamily: 'var(--font-family-display)' }}
              >
                Review Your List
              </h2>
              <p className="text-white/50 text-sm">
                {reviewItems.length} {reviewItems.length === 1 ? 'item' : 'items'} — remove any you don't want to rank
              </p>
            </div>

            {/* Search filter */}
            {reviewItems.length > 8 && (
              <div className="relative">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-white/25 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={reviewSearch}
                  onChange={e => setReviewSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/90 text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500/40 transition-colors"
                />
              </div>
            )}

            {/* Item list */}
            <div className="space-y-1.5 max-h-[28rem] overflow-y-auto rounded-xl">
              <AnimatePresence mode="popLayout">
                {filteredReviewItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-3 p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl group hover:bg-white/[0.05] transition-colors"
                  >
                    {/* Number */}
                    <span className="text-xs text-white/25 w-6 text-right flex-shrink-0 tabular-nums">
                      {reviewItems.indexOf(item) + 1}
                    </span>

                    {/* Thumbnail */}
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600/15 to-violet-400/5 flex-shrink-0" />
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/90 font-medium truncate">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-xs text-white/40 truncate">{item.subtitle}</p>
                      )}
                    </div>

                    {/* Remove button */}
                    <motion.button
                      onClick={() => handleReviewRemove(item.id)}
                      className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title="Remove from ranking"
                    >
                      <X size={16} />
                    </motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Start button */}
            <motion.div
              animate={{
                scale: reviewItems.length >= 2 ? 1 : 0.95,
                opacity: reviewItems.length >= 2 ? 1 : 0.5,
              }}
            >
              <Button
                onClick={handleStartFromReview}
                variant="primary"
                fullWidth
                size="lg"
                disabled={reviewItems.length < 2}
                className="w-full"
              >
                <Play size={18} className="mr-1" />
                Start Ranking
                <span className="text-sm font-normal opacity-70 ml-1">
                  ({reviewItems.length} {reviewItems.length === 1 ? 'item' : 'items'})
                </span>
              </Button>
            </motion.div>

            {reviewItems.length < 2 && (
              <p className="text-xs text-red-400 text-center">
                Need at least 2 items to start ranking
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mb-6">
            <Trophy className="mx-auto mb-4 text-violet-400" size={44} />
            <h2
              className="text-2xl font-bold text-white mb-2 tracking-tight"
              style={{ fontFamily: 'var(--font-family-display)' }}
            >
              Ranking Complete!
            </h2>
            <p className="text-white/55">
              {progress?.comparisons || 0} comparisons made
            </p>
          </div>
          <Button onClick={() => navigate('/')} variant="primary">
            Start Over
          </Button>
        </div>
      </div>
    );
  }

  return (
    // h-dvh + overflow-hidden = the page CANNOT scroll = no scrollbar can ever appear.
    // All sections are flex-shrink-0 = nothing shifts on mobile.
    <div className="h-screen h-dvh bg-bg-primary flex flex-col overflow-hidden">

      {/* Fixed progress strip at very top */}
      {progress && (
        <div className="fixed top-0 left-0 right-0 h-[3px] z-50 bg-white/[0.04] flex-shrink-0">
          <motion.div
            className="h-full bg-gradient-to-r from-violet-700 via-violet-500 to-fuchsia-500"
            style={{ boxShadow: '0 0 10px rgba(139,92,246,0.9)' }}
            animate={{ width: `${Math.round(progress.progress * 100)}%` }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          />
        </div>
      )}

      {/* Back Confirmation Dialog — uses position:fixed internally, unaffected by overflow-hidden */}
      <Modal
        isOpen={showBackDialog}
        onClose={() => setShowBackDialog(false)}
        title="Leave Ranking?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-white/65 text-sm leading-relaxed">
            You've made {progress?.comparisons || 0} comparisons. Save your progress to continue later, or leave without saving.
          </p>
          <div className="flex flex-col gap-2">
            <Button variant="primary" fullWidth onClick={handleSaveAndExit} disabled={isSavingAndExiting}>
              <Save size={15} className="mr-1.5" />
              {isSavingAndExiting ? 'Saving…' : 'Save & Exit'}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" fullWidth onClick={() => setShowBackDialog(false)} className="text-white/65">
                Keep Ranking
              </Button>
              <Button
                variant="danger"
                fullWidth
                onClick={() => {
                  if (!user && rankingState) clearGuestSession(presetId, rankingState.listTitle);
                  setShowBackDialog(false);
                  navigate(-1);
                }}
              >
                Leave
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Milestone toast — position:fixed, outside layout flow */}
      <AnimatePresence>
        {showMilestone && shownMilestone && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
          >
            <div className="px-4 py-2 rounded-full bg-violet-600/90 backdrop-blur-sm shadow-lg shadow-violet-600/30 border border-violet-400/20">
              <span className="text-white text-sm font-semibold tracking-tight">
                {shownMilestone === 25 && '⚡ Quarter way there!'}
                {shownMilestone === 50 && '🔥 Halfway done!'}
                {shownMilestone === 75 && '🚀 Almost there!'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header — fixed height, never changes */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-8 border-b border-white/[0.07]" style={{ height: '56px' }}>
        <button
          onClick={handleBack}
          className="p-2 -ml-2 rounded-lg text-white/50 hover:text-white/85 hover:bg-white/[0.07] transition-colors touch-target"
          aria-label="Go back"
        >
          <ArrowLeft size={19} />
        </button>

        <div className="text-center flex-1 px-3 min-w-0">
          <h1
            className="text-sm font-bold text-white/88 truncate tracking-tight"
            style={{ fontFamily: 'var(--font-family-display)' }}
          >
            {rankingState.listTitle}
          </h1>
          <p className="text-[11px] text-white/30 tabular-nums">
            {progress
              ? `${progress.comparisons} of ~${progress.estimatedTotal} comparisons`
              : `${rankingState.items.length} items`}
          </p>
        </div>

        {progress && progress.comparisons > 0 ? (
          <button
            onClick={handleSaveAndExit}
            disabled={isSavingAndExiting}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/45 hover:text-white/80 hover:bg-white/[0.07] transition-colors text-xs font-medium flex-shrink-0"
            title="Save progress and exit"
          >
            <Save size={14} />
            <span className="hidden sm:inline">Save</span>
          </button>
        ) : (
          <div className="w-8 flex-shrink-0" />
        )}
      </div>

      {/* Main content — flex-1 fills remaining space, overflow-hidden keeps it contained */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-3 sm:py-4 overflow-hidden min-h-0 gap-4 sm:gap-5">

        {/* Prompt — static text, no AnimatePresence that could shift layout */}
        <p
          className="flex-shrink-0 text-center text-base sm:text-xl font-bold text-white/60 leading-tight tracking-tight px-2"
          style={{ fontFamily: 'var(--font-family-display)' }}
        >
          {currentPrompt}
        </p>

        {/* Card comparison — aspect-ratio slots, absolute cards, zero layout impact */}
        <div className="flex-shrink-0 flex gap-3 sm:gap-4 w-full max-w-xl sm:max-w-2xl">

          {/* Left slot — aspect-ratio sets height; overflow-hidden clips all animations */}
          <div className="flex-1 relative rounded-2xl overflow-hidden" style={{ aspectRatio: '2/3' }}>
            <AnimatePresence custom={lastChosenSideRef}>
              <motion.button
                key={comparison.left.id}
                onClick={() => handleCardChoice('left')}
                disabled={isAnimating}
                custom={lastChosenSideRef}
                variants={{
                  enter: { opacity: 0, scale: 0.96 },
                  show: { opacity: 1, scale: 1, transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] } },
                  exit: (ref: typeof lastChosenSideRef) => ({
                    opacity: 0,
                    scale: ref.current === 'left' ? 1.05 : 0.93,
                    transition: { duration: 0.12, ease: 'easeIn' },
                  }),
                }}
                initial="enter"
                animate="show"
                exit="exit"
                className={`absolute inset-0 group ${isAnimating ? 'cursor-default' : 'cursor-pointer'}`}
                whileHover={!isAnimating ? { scale: 1.03 } : {}}
                whileTap={!isAnimating ? { scale: 0.97 } : {}}
              >
                {comparison.left.imageUrl ? (
                  <img src={comparison.left.imageUrl} alt={comparison.left.title} className="absolute inset-0 w-full h-full object-cover" loading="eager" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-800/40 via-violet-900/30 to-[#06060e]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                {selectedCard === 'left' && <div className="absolute inset-0 bg-violet-500/15" />}
                <div className={`absolute inset-0 rounded-2xl border pointer-events-none transition-colors duration-75 ${
                  selectedCard === 'left' ? 'border-violet-400/70' : 'border-white/[0.08] group-hover:border-white/[0.22]'
                }`} />
                <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                  <h3 className="font-bold text-white text-sm sm:text-[15px] leading-snug drop-shadow-sm">{comparison.left.title}</h3>
                  {comparison.left.subtitle && <p className="text-white/55 text-xs mt-0.5">{comparison.left.subtitle}</p>}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(comparison.left.id); }}
                  disabled={isAnimating}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white/35 hover:text-white/80 hover:bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 z-10"
                >
                  <X size={11} />
                </button>
              </motion.button>
            </AnimatePresence>
          </div>

          {/* VS Divider */}
          <div className="flex flex-col justify-center items-center flex-shrink-0 w-7 sm:w-9">
            <motion.div
              animate={selectedCard ? { scale: 0.75, opacity: 0.2 } : { scale: [1, 1.14, 1], opacity: [0.45, 0.72, 0.45] }}
              transition={selectedCard ? { duration: 0.1 } : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-violet-500/25 flex items-center justify-center"
              style={{ background: 'rgba(139,92,246,0.08)', boxShadow: '0 0 12px rgba(139,92,246,0.12)' }}
            >
              <span className="text-[8px] font-black tracking-[0.12em] text-violet-300/55 select-none uppercase">vs</span>
            </motion.div>
          </div>

          {/* Right slot */}
          <div className="flex-1 relative rounded-2xl overflow-hidden" style={{ aspectRatio: '2/3' }}>
            <AnimatePresence custom={lastChosenSideRef}>
              <motion.button
                key={comparison.right.id}
                onClick={() => handleCardChoice('right')}
                disabled={isAnimating}
                custom={lastChosenSideRef}
                variants={{
                  enter: { opacity: 0, scale: 0.96 },
                  show: { opacity: 1, scale: 1, transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] } },
                  exit: (ref: typeof lastChosenSideRef) => ({
                    opacity: 0,
                    scale: ref.current === 'right' ? 1.05 : 0.93,
                    transition: { duration: 0.12, ease: 'easeIn' },
                  }),
                }}
                initial="enter"
                animate="show"
                exit="exit"
                className={`absolute inset-0 group ${isAnimating ? 'cursor-default' : 'cursor-pointer'}`}
                whileHover={!isAnimating ? { scale: 1.03 } : {}}
                whileTap={!isAnimating ? { scale: 0.97 } : {}}
              >
                {comparison.right.imageUrl ? (
                  <img src={comparison.right.imageUrl} alt={comparison.right.title} className="absolute inset-0 w-full h-full object-cover" loading="eager" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-800/40 via-violet-900/30 to-[#06060e]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                {selectedCard === 'right' && <div className="absolute inset-0 bg-violet-500/15" />}
                <div className={`absolute inset-0 rounded-2xl border pointer-events-none transition-colors duration-75 ${
                  selectedCard === 'right' ? 'border-violet-400/70' : 'border-white/[0.08] group-hover:border-white/[0.22]'
                }`} />
                <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                  <h3 className="font-bold text-white text-sm sm:text-[15px] leading-snug drop-shadow-sm">{comparison.right.title}</h3>
                  {comparison.right.subtitle && <p className="text-white/55 text-xs mt-0.5">{comparison.right.subtitle}</p>}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(comparison.right.id); }}
                  disabled={isAnimating}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white/35 hover:text-white/80 hover:bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 z-10"
                >
                  <X size={11} />
                </button>
              </motion.button>
            </AnimatePresence>
          </div>

        </div>

        {/* Controls — flex-shrink-0, always same height, nothing shifts */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <Button
            onClick={handleUndo}
            disabled={!canUndo || isAnimating}
            variant="ghost"
            size="sm"
            className="text-white/40 hover:text-white/65"
          >
            <Undo2 size={14} />
            Undo
          </Button>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-white/[0.15]">
            <kbd className="px-1.5 py-0.5 rounded border border-white/[0.09] bg-white/[0.04] font-mono text-[10px] leading-tight">←</kbd>
            <span>left</span>
            <span className="text-white/[0.08] mx-1">·</span>
            <kbd className="px-1.5 py-0.5 rounded border border-white/[0.09] bg-white/[0.04] font-mono text-[10px] leading-tight">→</kbd>
            <span>right</span>
            <span className="text-white/[0.08] mx-1">·</span>
            <kbd className="px-1.5 py-0.5 rounded border border-white/[0.09] bg-white/[0.04] font-mono text-[10px] leading-tight">Z</kbd>
            <span>undo</span>
          </div>
        </div>

      </div>

      {/* Progress bar — fixed height at bottom, always present */}
      {progress && (
        <div className="flex-shrink-0 px-5 sm:px-10 py-3 sm:py-4 border-t border-white/[0.06]">
          <ProgressBar
            comparisons={progress.comparisons}
            estimatedTotal={progress.estimatedTotal}
            progress={progress.progress}
          />
        </div>
      )}

    </div>
  );
}