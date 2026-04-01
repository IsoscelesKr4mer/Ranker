import { useState, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Share2, RotateCcw, Grid3X3, Save, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { PageLayout } from '@/components/layout';
import { RankingDisplay } from '@/components/RankingDisplay';
import { ShareModal } from '@/components/ShareModal';
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
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [savedResultId, setSavedResultId] = useState<string | null>(null);
  const [profileSaveState, setProfileSaveState] = useState<SaveState>('idle');
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

  const saveAndRedirectToAuth = () => {
    sessionStorage.setItem('pendingResults', JSON.stringify(state));
    navigate('/auth');
  };

  // Kick off saving for the share link (public) in the background
  const ensureShareLink = useCallback(async () => {
    if (shareLink || isSavingLink || savedResultId) return;
    setIsSavingLink(true);
    try {
      const response = await saveRankingResult({
        sessionId: state?.sessionId,
        listTitle,
        results: result,
        comparisonsMade: comparisons,
        isPublic: true,
      });
      if (!('error' in response)) {
        setSavedResultId(response.resultId);
        if (response.shareId) {
          setShareLink(`${window.location.origin}/shared/${response.shareId}`);
        }
      }
    } catch (err) {
      console.error('Failed to create share link:', err);
    } finally {
      setIsSavingLink(false);
    }
  }, [shareLink, isSavingLink, savedResultId, state, listTitle, result, comparisons]);

  const handleOpenShareModal = () => {
    if (!user) {
      saveAndRedirectToAuth();
      return;
    }
    setShareModalOpen(true);
    ensureShareLink();
  };

  const handleSaveToProfile = async () => {
    if (!user) {
      saveAndRedirectToAuth();
      return;
    }

    if (savedResultId) {
      setProfileSaveState('saved');
      setTimeout(() => setProfileSaveState('idle'), 2000);
      return;
    }

    try {
      setProfileSaveState('saving');
      setSaveError(null);

      const response = await saveRankingResult({
        sessionId: state?.sessionId,
        listTitle,
        results: result,
        comparisonsMade: comparisons,
        isPublic: false,
      });

      if ('error' in response) {
        setProfileSaveState('error');
        setSaveError(response.error);
        setTimeout(() => { setProfileSaveState('idle'); setSaveError(null); }, 3000);
        return;
      }

      setSavedResultId(response.resultId);
      setProfileSaveState('saved');
      setTimeout(() => setProfileSaveState('idle'), 2000);
    } catch (err) {
      console.error('Failed to save ranking:', err);
      setProfileSaveState('error');
      setSaveError('Failed to save ranking to profile');
      setTimeout(() => { setProfileSaveState('idle'); setSaveError(null); }, 3000);
    }
  };

  return (
    <PageLayout maxWidth="xl">
      <div className="space-y-10 py-8">
        {/* Header */}
        <motion.div
          className="space-y-2 text-center"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p
            className="text-[10px] font-bold tracking-[0.25em] uppercase"
            style={{ color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-family-display)' }}
          >
            Your Ranking
          </p>
          <h1
            className="text-3xl sm:text-4xl font-bold text-white tracking-tight"
            style={{ fontFamily: 'var(--font-family-display)' }}
          >
            {listTitle}
          </h1>
          <p className="text-white/35 text-sm">
            {result.length} items · {comparisons} comparison{comparisons !== 1 ? 's' : ''}
          </p>
        </motion.div>

        {/* Rankings */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.08 }}
        >
          <RankingDisplay items={result} />
        </motion.div>

        {/* Error feedback */}
        {saveError && (
          <motion.div
            className="p-4 bg-red-500/10 border border-red-500/25 rounded-xl text-red-300 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {saveError}
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Button
            onClick={handleOpenShareModal}
            variant="primary"
            size="lg"
            fullWidth
          >
            <Share2 className="w-4 h-4" />
            Share Results
          </Button>

          <Button
            onClick={handleSaveToProfile}
            variant="secondary"
            size="lg"
            fullWidth
            disabled={profileSaveState === 'saving'}
          >
            {profileSaveState === 'saving' ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : profileSaveState === 'saved' ? (
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

          <Button onClick={() => navigate('/browse')} variant="secondary" size="lg" fullWidth>
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

      {/* Share modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        listTitle={listTitle}
        items={result}
        shareLink={shareLink}
        isSavingLink={isSavingLink}
      />
    </PageLayout>
  );
}
