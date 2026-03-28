import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, ProgressBar } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { useRanking } from '@/hooks/useRanking';
import { getPresetById } from '@/data/presets';
import { importLetterboxdList } from '@/lib/letterboxd';
import { searchMovies } from '@/lib/tmdb';
import { saveRankingSession, updateRankingSession, completeRankingSession } from '@/lib/database';
import { useAuthStore } from '@/store/authStore';
import type { RankItem } from '@/types';
import { Undo2, X, ArrowLeft, Trophy, Search, Play } from 'lucide-react';

// Prompt rotation system based on category
const COMPARISON_PROMPTS = {
  movies: [
    "You can only watch one ever again. Which one?",
    "It's movie night. Which are you putting on?",
    "One gets erased from history. Which do you save?",
    "Which would you recommend to a friend?",
    "Which one gets the midnight slot?",
  ],
  games: [
    "You can only play one ever again. Which one?",
    "Game time. Which are you loading?",
    "Your shelf is full. Which stays?",
    "Which one do you boot up at 2am?",
    "Speedrun this: which one matters most?",
  ],
  tv: [
    "One season left to watch. Which show?",
    "Binge night. What's your pick?",
    "Only one series remains. Which survives?",
    "Which one do you press play on?",
  ],
  default: [
    "Which do you prefer?",
    "If you could only keep one, which would it be?",
    "Which one matters more?",
    "Which is the winner?",
    "Your choice.",
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
  const { presetId } = useParams<{ presetId: string }>();
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
    makeChoice,
    undoChoice,
    removeFromRanking,
  } = useRanking();

  const [rankingState, setRankingState] = useState<RankingState | null>(null);
  const [promptIndex, setPromptIndex] = useState(0);
  const [showBackDialog, setShowBackDialog] = useState(false);
  const [selectedCard, setSelectedCard] = useState<'left' | 'right' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

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

      if (presetId) {
        const preset = getPresetById(presetId);
        if (preset) {
          items = preset.items;
          title = preset.title;
          category = preset.category.toLowerCase();
          source = 'preset';
        } else {
          navigate('/');
          return;
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
          title = 'Letterboxd Import';
          category = 'movies';
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
      }
      setIsLoading(false);
    };

    initializeRanking();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, searchParams, location.state, navigate]);

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
      if (
        user &&
        sessionId &&
        sortState &&
        progress &&
        progress.comparisons > 0 &&
        progress.comparisons % 5 === 0
      ) {
        await updateRankingSession(sessionId, {
          sortState,
          comparisonsMade: progress.comparisons,
        });
      }
    };

    autoSave();
  }, [user, sessionId, sortState, progress]);

  // Handle completion
  useEffect(() => {
    const handleCompletion = async () => {
      if (result && rankingState) {
        if (user && sessionId) {
          await completeRankingSession(sessionId);
        }

        navigate('/results', {
          state: {
            result,
            listTitle: rankingState.listTitle,
            comparisons: progress?.comparisons || 0,
            source: rankingState.source,
            sessionId,
          },
        });
      }
    };

    handleCompletion();
  }, [result, rankingState, navigate, progress, user, sessionId]);

  const handleCardChoice = useCallback(
    (side: 'left' | 'right') => {
      if (isAnimating) return;
      setSelectedCard(side);
      setTimeout(() => {
        makeChoice(side);
        setSelectedCard(null);
      }, 150);
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

  const handleStartFromReview = useCallback(async () => {
    if (reviewItems.length < 2) return;

    // Update ranking state with pruned items
    setRankingState(prev => prev ? { ...prev, items: reviewItems } : null);
    startRanking(reviewItems);
    setReviewMode(false);

    // Save session if authenticated
    if (user && sortState) {
      const result = await saveRankingSession({
        listId: location.state?.listId,
        listTitle: rankingState?.listTitle || '',
        items: reviewItems,
        sortState,
        comparisonsMade: 0,
        estimatedTotal: reviewItems.length,
      });
      if ('sessionId' in result) {
        setSessionId(result.sessionId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewItems, startRanking, user, rankingState]);

  const handleReviewRemove = useCallback((id: string) => {
    setReviewItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const currentPrompt = useMemo(() => {
    if (!rankingState) return 'Which do you prefer?';
    const prompts =
      COMPARISON_PROMPTS[rankingState.category as keyof typeof COMPARISON_PROMPTS] ||
      COMPARISON_PROMPTS.default;
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
    <div className="min-h-screen bg-bg-primary flex flex-col pb-6 sm:pb-8 px-8 sm:px-12">
      {/* Back Confirmation Dialog */}
      <Modal
        isOpen={showBackDialog}
        onClose={() => setShowBackDialog(false)}
        title="Leave Ranking?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-white/65 text-sm leading-relaxed">
            You've made {progress?.comparisons || 0} comparisons. Your progress will be lost.
          </p>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              fullWidth
              onClick={() => setShowBackDialog(false)}
              className="text-white/65"
            >
              Continue
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={() => {
                setShowBackDialog(false);
                navigate(-1);
              }}
            >
              Leave
            </Button>
          </div>
        </div>
      </Modal>

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
          <p className="text-[11px] text-white/38 mt-0.5">
            {rankingState.items.length} items
          </p>
        </div>

        <div className="w-8" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center py-4 sm:py-6">
        {/* Comparison Prompt */}
        <motion.div
          key={`prompt-${promptIndex}`}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25 }}
          className="mb-4 sm:mb-6 text-center px-2"
        >
          <p
            className="text-2xl sm:text-3xl font-bold text-white/88 leading-tight tracking-tight"
            style={{ fontFamily: 'var(--font-family-display)' }}
          >
            {currentPrompt}
          </p>
        </motion.div>

        {/* Comparison Cards */}
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={`comparison-${comparison.left.id}-${comparison.right.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex gap-4 sm:gap-6 items-stretch"
            >
              {/* Left Card */}
              <motion.button
                onClick={() => handleCardChoice('left')}
                disabled={isAnimating}
                className={`flex-1 group relative rounded-2xl overflow-hidden transition-all touch-target ${
                  isAnimating ? 'cursor-default' : 'cursor-pointer'
                }`}
                whileHover={!isAnimating ? { scale: 1.025, y: -2 } : {}}
                whileTap={!isAnimating ? { scale: 0.975 } : {}}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={comparison.left.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{
                      opacity: 0,
                      scale: selectedCard === 'left' ? 1.08 : 0.92,
                      x: selectedCard === 'left' ? 0 : -40,
                    }}
                    transition={{ duration: 0.2 }}
                    className="w-full h-full"
                  >
                    <div
                      className={`relative w-full h-full flex flex-col rounded-2xl overflow-hidden border transition-all duration-150 ${
                        selectedCard === 'left'
                          ? 'border-violet-400/50 shadow-[0_0_0_2px_rgba(139,92,246,0.3)]'
                          : 'border-white/[0.10] group-hover:border-white/[0.18]'
                      }`}
                      style={{ background: 'rgba(255,255,255,0.04)' }}
                    >
                      {/* Image */}
                      <div className="relative w-full bg-[#06060e] overflow-hidden aspect-[2/3]">
                        {comparison.left.imageUrl ? (
                          <>
                            <img
                              src={comparison.left.imageUrl}
                              alt={comparison.left.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600/15 to-violet-400/5">
                            <span className="text-white/25 text-center px-4 text-sm">
                              {comparison.left.title}
                            </span>
                          </div>
                        )}

                        {/* Selected overlay */}
                        <AnimatePresence>
                          {selectedCard === 'left' && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 bg-violet-500/15"
                            />
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Text */}
                      <div className="px-3 pt-2.5 pb-2 sm:px-4 flex-1 flex flex-col">
                        <h3 className="font-bold text-white/92 text-sm sm:text-base text-left leading-tight">
                          {comparison.left.title}
                        </h3>
                        {comparison.left.subtitle && (
                          <p className="text-white/45 text-xs text-left mt-0.5">
                            {comparison.left.subtitle}
                          </p>
                        )}
                        <motion.button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(comparison.left.id);
                          }}
                          disabled={isAnimating}
                          className="mt-auto pt-1.5 px-2 py-0.5 rounded-md bg-white/[0.06] text-white/35 hover:text-red-400 hover:bg-red-500/10 text-[11px] font-medium transition-colors whitespace-nowrap self-start"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Haven't seen it
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </motion.button>

              {/* VS Divider */}
              <div className="flex flex-col justify-center items-center flex-shrink-0 px-0.5 sm:px-1">
                <div
                  className="w-px"
                  style={{
                    height: 56,
                    background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.10), transparent)',
                  }}
                />
                <span className="my-2.5 text-[10px] font-bold tracking-[0.18em] text-white/22 uppercase select-none">
                  vs
                </span>
                <div
                  className="w-px"
                  style={{
                    height: 56,
                    background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.10), transparent)',
                  }}
                />
              </div>

              {/* Right Card */}
              <motion.button
                onClick={() => handleCardChoice('right')}
                disabled={isAnimating}
                className={`flex-1 group relative rounded-2xl overflow-hidden transition-all touch-target ${
                  isAnimating ? 'cursor-default' : 'cursor-pointer'
                }`}
                whileHover={!isAnimating ? { scale: 1.025, y: -2 } : {}}
                whileTap={!isAnimating ? { scale: 0.975 } : {}}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={comparison.right.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{
                      opacity: 0,
                      scale: selectedCard === 'right' ? 1.08 : 0.92,
                      x: selectedCard === 'right' ? 0 : 40,
                    }}
                    transition={{ duration: 0.2 }}
                    className="w-full h-full"
                  >
                    <div
                      className={`relative w-full h-full flex flex-col rounded-2xl overflow-hidden border transition-all duration-150 ${
                        selectedCard === 'right'
                          ? 'border-violet-400/50 shadow-[0_0_0_2px_rgba(139,92,246,0.3)]'
                          : 'border-white/[0.10] group-hover:border-white/[0.18]'
                      }`}
                      style={{ background: 'rgba(255,255,255,0.04)' }}
                    >
                      {/* Image */}
                      <div className="relative w-full bg-[#06060e] overflow-hidden aspect-[2/3]">
                        {comparison.right.imageUrl ? (
                          <>
                            <img
                              src={comparison.right.imageUrl}
                              alt={comparison.right.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600/15 to-violet-400/5">
                            <span className="text-white/25 text-center px-4 text-sm">
                              {comparison.right.title}
                            </span>
                          </div>
                        )}

                        <AnimatePresence>
                          {selectedCard === 'right' && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 bg-violet-500/15"
                            />
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Text */}
                      <div className="px-3 pt-2.5 pb-2 sm:px-4 flex-1 flex flex-col">
                        <h3 className="font-bold text-white/92 text-sm sm:text-base text-left leading-tight">
                          {comparison.right.title}
                        </h3>
                        {comparison.right.subtitle && (
                          <p className="text-white/45 text-xs text-left mt-0.5">
                            {comparison.right.subtitle}
                          </p>
                        )}
                        <motion.button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(comparison.right.id);
                          }}
                          disabled={isAnimating}
                          className="mt-auto pt-1.5 px-2 py-0.5 rounded-md bg-white/[0.06] text-white/35 hover:text-red-400 hover:bg-red-500/10 text-[11px] font-medium transition-colors whitespace-nowrap self-start"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Haven't seen it
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </motion.button>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Undo */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="mt-8 sm:mt-10"
        >
          <Button
            onClick={handleUndo}
            disabled={!canUndo || isAnimating}
            variant="ghost"
            size="sm"
            className="text-white/42 hover:text-white/65"
          >
            <Undo2 size={14} />
            Undo
          </Button>
        </motion.div>
      </div>

      {/* Progress Bar */}
      {progress && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="pt-6 sm:pt-8 border-t border-white/[0.07] mt-auto"
        >
          <ProgressBar
            comparisons={progress.comparisons}
            estimatedTotal={progress.estimatedTotal}
            progress={progress.progress}
          />
        </motion.div>
      )}
    </div>
  );
}