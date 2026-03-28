import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Share2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { PageLayout } from '@/components/layout';
import { getResultById, deleteResult } from '@/lib/database';
import type { RankItem } from '@/types';

export default function SavedResult() {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
    getResultById(resultId).then((data) => {
      setResult(data);
      setLoading(false);
    });
  }, [resultId]);

  const handleDelete = async () => {
    if (!resultId) return;
    setDeleting(true);
    const res = await deleteResult(resultId);
    if (!res.error) {
      navigate('/dashboard');
    } else {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleShare = async () => {
    if (result?.shareId) {
      const link = `${window.location.origin}/shared/${result.shareId}`;
      await navigator.clipboard.writeText(link);
    }
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
  const [first, second, third, ...rest] = items;

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
            {listTitle}
          </h1>
          <p className="text-white/40 text-sm">
            {items.length} items ranked in {comparisonsMade} comparison{comparisonsMade !== 1 ? 's' : ''} • {new Date(result.createdAt).toLocaleDateString()}
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
                <div className="relative">
                  <div
                    className="absolute -inset-3 rounded-3xl opacity-50 blur-xl"
                    style={{ background: 'radial-gradient(ellipse at center, rgba(234,179,8,0.18) 0%, transparent 70%)' }}
                  />
                  <div
                    className="relative overflow-hidden rounded-2xl border-2 border-yellow-500/50"
                    style={{ background: 'rgba(255,255,255,0.045)', boxShadow: '0 0 0 1px rgba(234,179,8,0.15), 0 24px 48px -8px rgba(0,0,0,0.5)' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/8 to-amber-600/4 pointer-events-none rounded-2xl" />
                    <div className="relative p-6 space-y-4">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-3xl">🥇</span>
                        <span className="text-xs font-bold text-yellow-400/90 tracking-widest uppercase" style={{ fontFamily: 'var(--font-family-display)' }}>#1 Winner</span>
                      </div>
                      {first.imageUrl && (
                        <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-2xl bg-[#06060e]">
                          <img src={first.imageUrl} alt={first.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        </div>
                      )}
                      <div className="text-center space-y-1.5">
                        <h3 className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: 'var(--font-family-display)' }}>{first.title}</h3>
                        {first.subtitle && <p className="text-white/55 text-sm">{first.subtitle}</p>}
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
                {second && (
                  <div className="relative overflow-hidden rounded-2xl border border-slate-400/35" style={{ background: 'rgba(255,255,255,0.04)', boxShadow: '0 12px 28px -6px rgba(0,0,0,0.4)' }}>
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-400/6 to-slate-500/3 pointer-events-none" />
                    <div className="relative p-4 space-y-3">
                      <div className="flex items-center justify-center"><span className="text-2xl">🥈</span></div>
                      {second.imageUrl && (
                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-[#06060e]">
                          <img src={second.imageUrl} alt={second.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        </div>
                      )}
                      <div className="text-center space-y-1">
                        <h4 className="font-bold text-white/90 text-sm line-clamp-2 leading-tight">{second.title}</h4>
                        {second.subtitle && <p className="text-white/45 text-xs">{second.subtitle}</p>}
                      </div>
                    </div>
                  </div>
                )}
                {third && (
                  <div className="relative overflow-hidden rounded-2xl border border-orange-600/30" style={{ background: 'rgba(255,255,255,0.04)', boxShadow: '0 12px 28px -6px rgba(0,0,0,0.4)' }}>
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-600/6 to-orange-700/3 pointer-events-none" />
                    <div className="relative p-4 space-y-3">
                      <div className="flex items-center justify-center"><span className="text-2xl">🥉</span></div>
                      {third.imageUrl && (
                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-[#06060e]">
                          <img src={third.imageUrl} alt={third.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        </div>
                      )}
                      <div className="text-center space-y-1">
                        <h4 className="font-bold text-white/90 text-sm line-clamp-2 leading-tight">{third.title}</h4>
                        {third.subtitle && <p className="text-white/45 text-xs">{third.subtitle}</p>}
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
            <h3 className="text-xs font-bold text-white/40 px-1 uppercase tracking-widest mb-4">The Rest</h3>
            {rest.map((item, idx) => (
              <motion.div key={item.id} variants={itemVariants}>
                <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-150">
                  <div className="w-8 flex-shrink-0 text-right">
                    <span className="text-sm font-bold text-white/30 tabular-nums">{idx + 4}</span>
                  </div>
                  <div className="w-px h-6 bg-white/[0.08] flex-shrink-0" />
                  {item.imageUrl ? (
                    <div className="w-9 h-9 rounded-md overflow-hidden flex-shrink-0 bg-white/[0.05]">
                      <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-md bg-violet-600/15 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white/85 text-sm truncate leading-tight">{item.title}</p>
                    {item.subtitle && <p className="text-xs text-white/38 truncate mt-0.5">{item.subtitle}</p>}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Link to="/dashboard">
            <Button variant="secondary" size="md">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Button>
          </Link>
          {result.shareId && (
            <Button variant="secondary" size="md" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
              Copy Share Link
            </Button>
          )}
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
        </motion.div>
      </div>
    </PageLayout>
  );
}
