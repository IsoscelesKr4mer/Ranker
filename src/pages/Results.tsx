import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Share2, RotateCcw, Grid3X3, Save, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { PageLayout } from '@/components/layout';
import { useAuthStore } from '@/store/authStore';
import { saveRankingResult } from '@/lib/database';
import type { RankItem } from '@/types';

interface ResultsState {
  result: RankItem[];
  listTitle: string;
  comparisons: number;
  sessionId?: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Try location state first, then fall back to sessionStorage (for post-auth redirects)
  const locationState = location.state as ResultsState | null;
  const state: ResultsState | null = locationState?.result
    ? locationState
    : (() => {
        try {
          const pending = sessionStorage.getItem('pendingResults');
          if (pending) {
            sessionStorage.removeItem('pendingResults');
            const parsed = JSON.parse(pending);
            if (parsed?.result) return parsed as ResultsState;
          }
        } catch { /* ignore */ }
        return null;
      })();

  if (!state || !state.result) {
    return (
      <PageLayout maxWidth="lg">
        <motion.div
          className="space-y-8 py-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center space-y-4">
            <h1
              className="text-4xl font-bold text-white tracking-tight"
              style={{ fontFamily: 'var(--font-family-display)' }}
            >
              No Ranking Data
            </h1>
            <p className="text-white/60">
              It looks like there's no ranking to display. Start by selecting a list to rank.
            </p>
          </div>
          <div className="flex justify-center">
            <Link to="/browse">
              <Button variant="primary" size="lg">Browse Lists</Button>
            </Link>
          </div>
        </motion.div>
      </PageLayout>
    );
  }

  const { result, listTitle, comparisons } = state;
  const first = result[0];
  const second = result[1];
  const third = result[2];
  const rest = result.slice(3);

  const saveAndRedirectToAuth = () => {
    // Save results to sessionStorage so they survive the OAuth redirect
    sessionStorage.setItem('pendingResults', JSON.stringify(state));
    navigate('/auth');
  };

  const handleShareResults = async () => {
    if (!user) {
      saveAndRedirectToAuth();
      return;
    }

    try {
      setSaveState('saving');
      setSaveError(null);

      const response = await saveRankingResult({
        sessionId: state?.sessionId || `session-${Date.now()}`,
        listTitle,
        results: result,
        comparisonsMade: comparisons,
        isPublic: true,
      });

      if ('error' in response) {
        setSaveState('error');
        setSaveError(response.error);
        setTimeout(() => { setSaveState('idle'); setSaveError(null); }, 3000);
        return;
      }

      if (response.shareId) {
        const link = `${window.location.origin}/shared/${response.shareId}`;
        setShareLink(link);
        await navigator.clipboard.writeText(link);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      }

      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err) {
      console.error('Failed to share results:', err);
      setSaveState('error');
      setSaveError('Failed to create shareable link');
      setTimeout(() => { setSaveState('idle'); setSaveError(null); }, 3000);
    }
  };

  const handleSaveToProfile = async () => {
    if (!user) {
      saveAndRedirectToAuth();
      return;
    }

    try {
      setSaveState('saving');
      setSaveError(null);

      const response = await saveRankingResult({
        sessionId: state?.sessionId || `session-${Date.now()}`,
        listTitle,
        results: result,
        comparisonsMade: comparisons,
        isPublic: false,
      });

      if ('error' in response) {
        setSaveState('error');
        setSaveError(response.error);
        setTimeout(() => { setSaveState('idle'); setSaveError(null); }, 3000);
        return;
      }

      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err) {
      console.error('Failed to save ranking:', err);
      setSaveState('error');
      setSaveError('Failed to save ranking to profile');
      setTimeout(() => { setSaveState('idle'); setSaveError(null); }, 3000);
    }
  };

  const handleRankAgain = () => {
    navigate('/browse');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.04, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -16 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.28 },
    },
  };

  return (
    <PageLayout maxWidth="xl">
      <div className="space-y-12 py-8">
        {/* Header */}
        <motion.div
          className="space-y-3 text-center"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1
            className="text-4xl sm:text-5xl font-bold text-white tracking-tight"
            style={{ fontFamily: 'var(--font-family-display)' }}
          >
            Your Ranking
          </h1>
          <h2 className="text-lg sm:text-xl text-white/65 font-medium">{listTitle}</h2>
          <p className="text-white/40 text-sm">
            Ranked {result.length} items in {comparisons} comparison{comparisons !== 1 ? 's' : ''}
          </p>
        </motion.div>

        {/* Podium */}
        {first && (
          <motion.div
            className="space-y-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {/* #1 — Gold */}
            <div className="flex justify-center">
              <motion.div
                className="w-full max-w-sm"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {/* Celebratory glow ring */}
                <div className="relative">
                  <div
                    className="absolute -inset-3 rounded-3xl opacity-50 blur-xl"
                    style={{
                      background: 'radial-gradient(ellipse at center, rgba(234,179,8,0.18) 0%, transparent 70%)',
                    }}
                  />
                  <div
                    className="relative overflow-hidden rounded-2xl border-2 border-yellow-500/50"
                    style={{ background: 'rgba(255,255,255,0.045)', boxShadow: '0 0 0 1px rgba(234,179,8,0.15), 0 24px 48px -8px rgba(0,0,0,0.5)' }}
                  >
                    {/* Gold tint overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/8 to-amber-600/4 pointer-events-none rounded-2xl" />

                    <div className="relative p-6 space-y-4">
                      {/* Crown badge */}
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-3xl">🥇</span>
                        <span
                          className="text-xs font-bold text-yellow-400/90 tracking-widest uppercase"
                          style={{ fontFamily: 'var(--font-family-display)' }}
                        >
                          #1 Winner
                        </span>
                      </div>

                      {/* Image */}
                      {first.imageUrl && (
                        <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-2xl bg-[#06060e]">
                          <motion.img
                            src={first.imageUrl}
                            alt={first.title}
                            className="w-full h-full object-cover"
                            initial={{ scale: 1.05 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.6 }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        </div>
                      )}

                      <div className="text-center space-y-1.5">
                        <h3
                          className="text-xl font-bold text-white tracking-tight"
                          style={{ fontFamily: 'var(--font-family-display)' }}
                        >
                          {first.title}
                        </h3>
                        {first.subtitle && (
                          <p className="text-white/55 text-sm">{first.subtitle}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* #2 and #3 */}
            {(second || third) && (
              <motion.div
                className="grid grid-cols-2 gap-4 sm:gap-5"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.32 }}
              >
                {/* #2 Silver */}
                {second && (
                  <div
                    className="relative overflow-hidden rounded-2xl border border-slate-400/35"
                    style={{ background: 'rgba(255,255,255,0.04)', boxShadow: '0 12px 28px -6px rgba(0,0,0,0.4)' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-400/6 to-slate-500/3 pointer-events-none" />
                    <div className="relative p-4 space-y-3">
                      <div className="flex items-center justify-center">
                        <span className="text-2xl">🥈</span>
                      </div>
                      {second.imageUrl && (
                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-[#06060e]">
                          <img src={second.imageUrl} alt={second.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        </div>
                      )}
                      <div className="text-center space-y-1">
                        <h4 className="font-bold text-white/90 text-sm line-clamp-2 leading-tight">
                          {second.title}
                        </h4>
                        {second.subtitle && (
                          <p className="text-white/45 text-xs">{second.subtitle}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* #3 Bronze */}
                {third && (
                  <div
                    className="relative overflow-hidden rounded-2xl border border-orange-600/30"
                    style={{ background: 'rgba(255,255,255,0.04)', boxShadow: '0 12px 28px -6px rgba(0,0,0,0.4)' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-600/6 to-orange-700/3 pointer-events-none" />
                    <div className="relative p-4 space-y-3">
                      <div className="flex items-center justify-center">
                        <span className="text-2xl">🥉</span>
                      </div>
                      {third.imageUrl && (
                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-[#06060e]">
                          <img src={third.imageUrl} alt={third.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        </div>
                      )}
                      <div className="text-center space-y-1">
                        <h4 className="font-bold text-white/90 text-sm line-clamp-2 leading-tight">
                          {third.title}
                        </h4>
                        {third.subtitle && (
                          <p className="text-white/45 text-xs">{third.subtitle}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Remaining Rankings */}
        {rest.length > 0 && (
          <motion.div
            className="space-y-1.5"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <h3 className="text-xs font-bold text-white/40 px-1 uppercase tracking-widest mb-4">
              The Rest
            </h3>
            {rest.map((item, idx) => (
              <motion.div key={item.id} variants={itemVariants}>
                <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-150">
                  {/* Rank Number */}
                  <div className="w-8 flex-shrink-0 text-right">
                    <span className="text-sm font-bold text-white/30 tabular-nums">
                      {idx + 4}
                    </span>
                  </div>

                  {/* Separator */}
                  <div className="w-px h-6 bg-white/[0.08] flex-shrink-0" />

                  {/* Thumbnail */}
                  {item.imageUrl ? (
                    <div className="w-9 h-9 rounded-md overflow-hidden flex-shrink-0 bg-white/[0.05]">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-md bg-violet-600/15 flex-shrink-0" />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white/85 text-sm truncate leading-tight">
                      {item.title}
                    </p>
                    {item.subtitle && (
                      <p className="text-xs text-white/38 truncate mt-0.5">{item.subtitle}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Error / Share link feedback */}
        {saveError && (
          <motion.div
            className="p-4 bg-red-500/10 border border-red-500/25 rounded-xl text-red-300 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {saveError}
          </motion.div>
        )}

        {shareLink && (
          <motion.div
            className="p-4 bg-green-500/10 border border-green-500/25 rounded-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-sm text-green-300 mb-2 font-medium">Share link copied to clipboard!</p>
            <code className="text-xs text-green-200/70 break-all">{shareLink}</code>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Button
            onClick={handleShareResults}
            variant={copyFeedback || saveState === 'saved' ? 'secondary' : 'primary'}
            size="lg"
            fullWidth
            disabled={saveState === 'saving'}
          >
            {saveState === 'saving' ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating link...
              </>
            ) : copyFeedback || saveState === 'saved' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Link Copied!
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                Share Results
              </>
            )}
          </Button>

          <Button
            onClick={handleSaveToProfile}
            variant="secondary"
            size="lg"
            fullWidth
            disabled={saveState === 'saving'}
          >
            {saveState === 'saving' ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : saveState === 'saved' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save to Profile
              </>
            )}
          </Button>

          <Button onClick={handleRankAgain} variant="secondary" size="lg" fullWidth>
            <RotateCcw className="w-4 h-4" />
            Rank Again
          </Button>

          <Link to="/browse" className="w-full">
            <Button variant="secondary" size="lg" fullWidth>
              <Grid3X3 className="w-4 h-4" />
              Browse More Lists
            </Button>
          </Link>
        </motion.div>
      </div>
    </PageLayout>
  );
}
