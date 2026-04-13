import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Share2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { PageLayout } from '@/components/layout';
import { RankingDisplay } from '@/components/RankingDisplay';
import { ShareModal } from '@/components/ShareModal';
import { getResultById, deleteResult, makeResultPublic } from '@/lib/database';
import { backfillMissingImages } from '@/lib/tmdb';
import { useAuthStore } from '@/store/authStore';
import type { RankItem } from '@/types';

export default function SavedResult() {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const { status } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [result, setResult] = useState<{
    id: string;
    listTitle: string;
    results: RankItem[];
    comparisonsMade: number;
    shareId?: string;
    createdAt: string;
  } | null>(null);

  useEffect(() => {
    if (!resultId) return;
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      navigate('/auth');
      return;
    }
    getResultById(resultId)
      .then(async (data) => {
        if (data) {
          data.results = await backfillMissingImages(data.results);
        }
        setResult(data);
        // Populate share link if the result is already public
        if (data?.shareId) {
          setShareLink(`${window.location.origin}/shared/${data.shareId}`);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load result:', err);
        setResult(null);
        setLoading(false);
      });
  }, [resultId, status]);

  const handleDelete = async () => {
    if (!resultId) return;
    setDeleting(true);
    try {
      const res = await deleteResult(resultId);
      if (!res.error) {
        navigate('/dashboard');
      } else {
        console.error('Delete failed:', res.error);
        alert('Failed to delete ranking. Please try again.');
        setDeleting(false);
        setConfirmDelete(false);
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete ranking. Please try again.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  // Generate a share link on demand (makes the result public if it isn't already)
  const ensureShareLink = useCallback(async () => {
    if (!result || shareLink || isSavingLink) return;
    setIsSavingLink(true);
    try {
      const res = await makeResultPublic(result.id);
      if ('shareId' in res) {
        setShareLink(`${window.location.origin}/shared/${res.shareId}`);
      }
    } catch (err) {
      console.error('Failed to generate share link:', err);
    } finally {
      setIsSavingLink(false);
    }
  }, [result, shareLink, isSavingLink]);

  const handleOpenShareModal = () => {
    setShareModalOpen(true);
    ensureShareLink();
  };

  if (loading) {
    return (
      <PageLayout maxWidth="xl">
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-violet-400 animate-pulse" />
            <span className="text-sm text-white/30">Loading ranking...</span>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!result) {
    return (
      <PageLayout maxWidth="xl">
        <div className="text-center py-32 space-y-4">
          <p className="text-white/50 text-lg">Ranking not found.</p>
          <Link to="/dashboard">
            <Button variant="secondary" size="sm">Back to Dashboard</Button>
          </Link>
        </div>
      </PageLayout>
    );
  }

  const { results: items, listTitle, comparisonsMade } = result;

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
            Saved Ranking
          </p>
          <h1
            className="text-3xl sm:text-4xl font-bold text-white tracking-tight"
            style={{ fontFamily: 'var(--font-family-display)' }}
          >
            {listTitle}
          </h1>
          <p className="text-white/35 text-sm">
            {items.length} items · {comparisonsMade} comparison{comparisonsMade !== 1 ? 's' : ''} · {new Date(result.createdAt).toLocaleDateString()}
          </p>
        </motion.div>

        {/* Rankings */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.08 }}
        >
          <RankingDisplay items={items} />
        </motion.div>

        {/* Actions */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Link to="/dashboard" className="w-full">
            <Button variant="secondary" size="lg" fullWidth>
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Button>
          </Link>

          <Button variant="primary" size="lg" fullWidth onClick={handleOpenShareModal}>
            <Share2 className="w-4 h-4" />
            Share Results
          </Button>

          <div className="sm:col-span-2 flex justify-center">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button variant="primary" size="md" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </Button>
                <Button variant="secondary" size="md" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </motion.div>
      </div>

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        listTitle={listTitle}
        items={items}
        shareLink={shareLink}
        isSavingLink={isSavingLink}
      />
    </PageLayout>
  );
}
