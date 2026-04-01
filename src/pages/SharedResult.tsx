import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Share2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { PageLayout } from '@/components/layout';
import { RankingDisplay } from '@/components/RankingDisplay';
import { ShareModal } from '@/components/ShareModal';
import { getSharedResult } from '@/lib/database';
import type { RankItem } from '@/types';

export default function SharedResult() {
  const { shareId } = useParams<{ shareId: string }>();
  const [loading, setLoading] = useState(true);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [result, setResult] = useState<{
    listTitle: string;
    results: RankItem[];
    comparisonsMade: number;
    createdAt: string;
  } | null>(null);

  useEffect(() => {
    if (!shareId) return;
    getSharedResult(shareId).then((data) => {
      setResult(data);
      setLoading(false);
    });
  }, [shareId]);

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
          <p className="text-white/50 text-lg">Ranking not found or no longer public.</p>
          <Link to="/">
            <Button variant="secondary" size="sm">Go Home</Button>
          </Link>
        </div>
      </PageLayout>
    );
  }

  const { results: items, listTitle, comparisonsMade } = result;
  // The share link is simply the current page URL
  const shareLink = window.location.href;

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
            Shared Ranking
          </p>
          <h1
            className="text-3xl sm:text-4xl font-bold text-white tracking-tight"
            style={{ fontFamily: 'var(--font-family-display)' }}
          >
            {listTitle}
          </h1>
          <p className="text-white/35 text-sm">
            {items.length} items · {comparisonsMade} comparison{comparisonsMade !== 1 ? 's' : ''}
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

        {/* CTAs */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Link to="/browse" className="w-full">
            <Button variant="secondary" size="lg" fullWidth>
              <ArrowLeft className="w-4 h-4" />
              Make Your Own Ranking
            </Button>
          </Link>

          <Button variant="primary" size="lg" fullWidth onClick={() => setShareModalOpen(true)}>
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        </motion.div>
      </div>

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        listTitle={listTitle}
        items={items}
        shareLink={shareLink}
        isSavingLink={false}
      />
    </PageLayout>
  );
}
