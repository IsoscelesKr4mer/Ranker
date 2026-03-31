import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, List, Calendar, Zap, ArrowLeft } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { PageLayout } from '@/components/layout';
import { getPublicProfile, getPublicUserLists, getPublicUserResults } from '@/lib/database';
import type { RankList, RankItem, PublicProfile } from '@/types';

export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [lists, setLists] = useState<RankList[]>([]);
  const [results, setResults] = useState<{ id: string; listTitle: string; results: RankItem[]; comparisonsMade: number; shareId?: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'lists' | 'rankings'>('lists');

  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    Promise.all([
      getPublicProfile(userId),
      getPublicUserLists(userId),
      getPublicUserResults(userId),
    ]).then(([profileData, listsData, resultsData]) => {
      setProfile(profileData);
      setLists(listsData);
      setResults(resultsData);
    }).finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <PageLayout maxWidth="lg">
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-violet-400 animate-pulse" />
            <span className="text-sm text-white/30">Loading profile...</span>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!profile) {
    return (
      <PageLayout maxWidth="lg">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <p className="text-white/50">Profile not found</p>
          <Link to="/community">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4" />
              Back to Community
            </Button>
          </Link>
        </div>
      </PageLayout>
    );
  }

  const displayName = profile.username || profile.displayName || 'Anonymous Ranker';
  const joinDate = new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <PageLayout maxWidth="lg">
      <div className="space-y-8 py-8">
        {/* Back link */}
        <Link
          to="/community"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Community
        </Link>

        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card padding="lg" className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-400 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <h1 className="text-2xl font-bold text-white">{displayName}</h1>
              {profile.username && profile.displayName && profile.displayName !== profile.username && (
                <p className="text-sm text-white/40">{profile.displayName}</p>
              )}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-white/40">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Joined {joinDate}
                </span>
                <span className="flex items-center gap-1.5">
                  <List className="w-3.5 h-3.5" />
                  {lists.length} {lists.length === 1 ? 'list' : 'lists'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5" />
                  {results.length} {results.length === 1 ? 'ranking' : 'rankings'}
                </span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1.5 border-b border-white/[0.06] pb-px">
          {([['lists', 'Lists', lists.length], ['rankings', 'Rankings', results.length]] as const).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium transition-all relative ${
                tab === key
                  ? 'text-violet-300'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {label}
              <span className="ml-1.5 text-xs text-white/25">{count}</span>
              {tab === key && (
                <motion.div
                  layoutId="profileTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-full"
                />
              )}
            </button>
          ))}
        </div>

        {/* Lists Tab */}
        {tab === 'lists' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {lists.length === 0 ? (
              <Card padding="lg" className="text-center py-12">
                <p className="text-white/40">No public lists yet</p>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {lists.map(list => (
                  <motion.div
                    key={list.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card hover padding="lg" className="h-full flex flex-col gap-3 group">
                      <div className="flex items-start gap-3">
                        {/* Mini cover grid */}
                        <div className="grid grid-cols-2 gap-0.5 w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.03]">
                          {list.items.slice(0, 4).map(item => (
                            <div key={item.id} className="bg-white/[0.05]">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-violet-600/10" />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white/90 group-hover:text-violet-300 transition-colors truncate">
                            {list.title}
                          </h3>
                          <p className="text-xs text-white/40 mt-1">
                            {list.itemCount} items · {list.category}
                          </p>
                        </div>
                      </div>
                      <Link to={`/ranking/preset/${list.id}`} className="mt-auto">
                        <Button variant="secondary" size="sm" fullWidth className="gap-1">
                          <Zap className="w-3 h-3" />
                          Rank This
                        </Button>
                      </Link>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Rankings Tab */}
        {tab === 'rankings' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {results.length === 0 ? (
              <Card padding="lg" className="text-center py-12">
                <p className="text-white/40">No public rankings yet</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {results.map(result => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Link to={result.shareId ? `/shared/${result.shareId}` : '#'}>
                      <Card hover padding="lg" className="group">
                        <div className="flex items-center gap-4">
                          {/* Top 3 mini posters */}
                          <div className="flex -space-x-2 flex-shrink-0">
                            {result.results.slice(0, 3).map((item, i) => (
                              <div
                                key={item.id}
                                className="w-10 h-14 rounded-lg overflow-hidden border-2 border-[#0c0c14] bg-white/[0.05]"
                                style={{ zIndex: 3 - i }}
                              >
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-violet-600/10 flex items-center justify-center">
                                    <span className="text-[8px] text-white/30">{i + 1}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white/90 group-hover:text-violet-300 transition-colors truncate">
                              {result.listTitle}
                            </h3>
                            <p className="text-xs text-white/40 mt-1">
                              {result.results.length} items ranked · {result.comparisonsMade} comparisons
                            </p>
                          </div>

                          <Trophy className="w-4 h-4 text-violet-400/50 flex-shrink-0" />
                        </div>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </PageLayout>
  );
}
