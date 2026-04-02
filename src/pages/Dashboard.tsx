import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, TrendingUp, Plus, Grid3X3, Import, Users, Trash2, UserCircle, Check, AlertCircle, Camera, Pencil } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { PageLayout } from '@/components/layout';
import { useAuthStore } from '@/store/authStore';
import {
  getUserStats,
  getUserLists,
  getUserResults,
  getInProgressSessions,
  deleteResult,
  deleteList,
  deleteRankingSession,
  updateProfile,
  isUsernameTaken,
  uploadAvatar,
} from '@/lib/database';
import type { RankList, RankingSession } from '@/types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, status, needsUsername, setUser, setNeedsUsername } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ listsCreated: 0, rankingsCompleted: 0, comparisonsMade: 0 });
  const [lists, setLists] = useState<RankList[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [inProgress, setInProgress] = useState<RankingSession[]>([]);

  // Username setup state
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameSuccess, setUsernameSuccess] = useState(false);

  // Avatar upload state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      loadData();
    } else {
      setLoading(false);
    }
  }, [status]);

  async function loadData() {
    try {
      setLoading(true);
      const [statsData, listsData, resultsData, inProgressData] = await Promise.all([
        getUserStats(),
        getUserLists(),
        getUserResults(),
        getInProgressSessions(),
      ]);
      setStats(statsData);
      setLists(listsData);
      setResults(resultsData);
      setInProgress(inProgressData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  // These must be declared before any early returns to satisfy Rules of Hooks.
  const handleSetUsername = useCallback(async () => {
    const trimmed = usernameInput.trim().toLowerCase();
    if (!trimmed) { setUsernameError('Username is required'); return; }
    if (trimmed.length < 3) { setUsernameError('At least 3 characters'); return; }
    if (trimmed.length > 24) { setUsernameError('Max 24 characters'); return; }
    if (!/^[a-z0-9_-]+$/.test(trimmed)) { setUsernameError('Only lowercase letters, numbers, hyphens, underscores'); return; }

    setUsernameSaving(true);
    setUsernameError('');

    const taken = await isUsernameTaken(trimmed, user?.id);
    if (taken) { setUsernameError('Username already taken'); setUsernameSaving(false); return; }

    const result = await updateProfile({ username: trimmed });
    if (result.error) { setUsernameError(result.error); setUsernameSaving(false); return; }

    if (user) setUser({ ...user, username: trimmed });
    setNeedsUsername(false);
    setUsernameSuccess(true);
    setTimeout(() => setUsernameSuccess(false), 3000);
    setUsernameSaving(false);
  }, [usernameInput, user, setUser, setNeedsUsername]);

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setAvatarUploading(true);
    const result = await uploadAvatar(file);
    if ('url' in result) {
      setUser({ ...user, avatarUrl: result.url });
    } else {
      alert(result.error);
    }
    setAvatarUploading(false);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  }, [user, setUser]);

  // Redirect to auth if not authenticated
  if (status === 'loading') {
    return (
      <PageLayout maxWidth="xl">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 border-4 border-violet-600/20 border-t-violet-500 rounded-full animate-spin mx-auto" />
            <p className="text-white/60">Loading...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <PageLayout maxWidth="xl">
        <motion.div
          className="flex items-center justify-center min-h-[60vh]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="max-w-md w-full p-8 space-y-6 text-center">
            <div className="space-y-3">
              <div className="w-16 h-16 bg-violet-600/20 border border-violet-500/30 rounded-2xl flex items-center justify-center mx-auto">
                <BarChart3 className="w-8 h-8 text-violet-300" />
              </div>
              <h2 className="text-2xl font-bold text-white">Sign In to Your Dashboard</h2>
              <p className="text-white/60">
                Create an account or sign in to save your rankings, track your stats, and manage your lists.
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <Link to="/auth" className="block">
                <Button variant="primary" fullWidth size="lg">
                  Sign In
                </Button>
              </Link>
              <Link to="/browse" className="block">
                <Button variant="secondary" fullWidth size="lg">
                  Continue as Guest
                </Button>
              </Link>
            </div>
          </Card>
        </motion.div>
      </PageLayout>
    );
  }

  const displayName = user?.username || user?.displayName || 'Ranker';

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3 },
    },
  };

  // Build stats array from real data
  const statsArray = [
    {
      label: 'Lists Created',
      value: String(stats.listsCreated),
      icon: Plus,
      color: 'from-blue-600 to-blue-500',
    },
    {
      label: 'Rankings Completed',
      value: String(stats.rankingsCompleted),
      icon: TrendingUp,
      color: 'from-purple-600 to-purple-500',
    },
    {
      label: 'Comparisons Made',
      value: String(stats.comparisonsMade),
      icon: BarChart3,
      color: 'from-pink-600 to-pink-500',
    },
  ];

  const quickStartItems = [
    {
      title: 'Browse Presets',
      description: 'Discover curated ranking lists',
      icon: Grid3X3,
      href: '/browse',
      color: 'from-violet-600 to-violet-500',
    },
    {
      title: 'Import from Letterboxd',
      description: 'Rank your film collections',
      icon: Import,
      href: '/browse?tab=letterboxd',
      color: 'from-amber-600 to-amber-500',
    },
    {
      title: 'Create Custom List',
      description: 'Build your own ranking list',
      icon: Plus,
      href: '/create',
      color: 'from-cyan-600 to-cyan-500',
    },
    {
      title: 'Community Lists',
      description: 'Explore lists from the community',
      icon: Users,
      href: '/community',
      color: 'from-emerald-600 to-emerald-500',
    },
  ];

  return (
    <PageLayout maxWidth="xl">
      <div className="space-y-12 py-8">
        {/* Welcome Header */}
        <motion.div
          className="flex items-center gap-5"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Avatar with upload */}
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarUploading}
            className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-400 flex items-center justify-center flex-shrink-0 overflow-hidden group cursor-pointer"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl sm:text-3xl font-bold text-white">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
              <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            {avatarUploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl font-bold text-white">
              Welcome back, {displayName}
            </h1>
            <p className="text-white/60 text-base sm:text-lg">
              Track your rankings, discover new lists, and connect with the community
            </p>
          </div>
        </motion.div>

        {/* Username Setup Banner */}
        <AnimatePresence>
          {needsUsername && !usernameSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="p-6 border border-violet-500/30 bg-gradient-to-r from-violet-600/10 to-violet-500/5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                      <UserCircle className="w-5 h-5 text-violet-300" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-medium text-white">Pick a username</p>
                      <p className="text-xs text-white/50">
                        This will be shown on your community lists and profile
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="flex-1 sm:w-48">
                      <Input
                        value={usernameInput}
                        onChange={(e) => {
                          setUsernameInput(e.target.value);
                          setUsernameError('');
                        }}
                        placeholder="your-username"
                        className="text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleSetUsername()}
                      />
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSetUsername}
                      disabled={usernameSaving || !usernameInput.trim()}
                    >
                      {usernameSaving ? '...' : 'Save'}
                    </Button>
                  </div>
                </div>
                {usernameError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1.5 mt-3 text-xs text-red-400"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    {usernameError}
                  </motion.div>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Username Success Toast */}
        <AnimatePresence>
          {usernameSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300"
            >
              <Check className="w-4 h-4" />
              Username saved! You're all set.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Cards */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {statsArray.map((stat) => {
            const Icon = stat.icon;
            return (
              <motion.div key={stat.label} variants={itemVariants}>
                <Card padding="lg" className="space-y-4 h-full">
                  <div className={`
                    w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color}
                    opacity-10 flex items-center justify-center
                  `}>
                    <Icon className="w-6 h-6 text-white/60" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-3xl font-bold text-white">
                      {loading ? '-' : stat.value}
                    </p>
                    <p className="text-white/60 text-sm">
                      {stat.label}
                    </p>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* In Progress Section — shown prominently when there are paused rankings */}
        {!loading && inProgress.length > 0 && (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white">Continue Ranking</h2>
              <p className="text-white/60">Pick up where you left off</p>
            </div>

            <div className="space-y-3">
              {inProgress.map((session) => (
                <div key={session.id} className="flex items-center gap-2">
                  <Link to={`/rank/${session.id}/resume`} className="flex-1">
                    <Card padding="lg" hover className="flex items-center justify-between">
                      <div className="space-y-1 flex-1">
                        <h3 className="font-semibold text-white">{session.listTitle}</h3>
                        <p className="text-xs text-white/50">
                          {session.comparisonsMade} of {session.estimatedTotal} comparisons • {new Date(session.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full"
                            style={{
                              width: `${Math.min(Math.round((session.comparisonsMade / Math.max(session.estimatedTotal, 1)) * 100), 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-white/40 tabular-nums w-8">
                          {Math.min(Math.round((session.comparisonsMade / Math.max(session.estimatedTotal, 1)) * 100), 100)}%
                        </span>
                        <div className="text-violet-400 text-sm font-medium">Resume →</div>
                      </div>
                    </Card>
                  </Link>
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm('Discard this ranking session?')) {
                        const res = await deleteRankingSession(session.id);
                        if (!res.error) {
                          setInProgress(prev => prev.filter(s => s.id !== session.id));
                        }
                      }
                    }}
                    className="p-2.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                    title="Discard session"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Quick Start Section */}
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Quick Start</h2>
            <p className="text-white/60">
              Jump into ranking with these shortcuts
            </p>
          </div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {quickStartItems.map((item) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.title} variants={itemVariants}>
                  <Link to={item.href}>
                    <Card hover className="p-6 space-y-4 h-full flex flex-col group">
                      <div className={`
                        w-12 h-12 rounded-xl bg-gradient-to-br ${item.color}
                        opacity-10 flex items-center justify-center group-hover:opacity-20
                        transition-all duration-200
                      `}>
                        <Icon className="w-6 h-6 text-white/80 group-hover:text-white transition-colors" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <h3 className="font-semibold text-white group-hover:text-violet-300 transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-xs text-white/50">
                          {item.description}
                        </p>
                      </div>
                      <div className="text-violet-400/0 group-hover:text-violet-300 transition-colors text-xs font-medium">
                        Start →
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>

        {/* Recent Rankings Section */}
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Recent Rankings</h2>
            <p className="text-white/60">
              Your latest ranking sessions
            </p>
          </div>

          {!loading && results.length > 0 ? (
            <div className="space-y-3">
              {results.map((result) => (
                <div key={result.id} className="flex items-center gap-2">
                  <Link to={`/results/${result.id}`} className="flex-1">
                    <Card padding="lg" hover className="flex items-center justify-between">
                      <div className="space-y-1 flex-1">
                        <h3 className="font-semibold text-white">{result.listTitle}</h3>
                        <p className="text-xs text-white/50">
                          {result.results.length} items • {result.comparisonsMade} comparisons • {new Date(result.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-violet-400 text-sm font-medium">View →</div>
                    </Card>
                  </Link>
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm('Delete this ranking?')) {
                        try {
                          const res = await deleteResult(result.id);
                          if (!res.error) {
                            setResults(prev => prev.filter(r => r.id !== result.id));
                          } else {
                            console.error('Delete failed:', res.error);
                            alert('Failed to delete ranking. Please try again.');
                          }
                        } catch (err) {
                          console.error('Delete error:', err);
                          alert('Failed to delete ranking. Please try again.');
                        }
                      }
                    }}
                    className="p-2.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                    title="Delete ranking"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Card padding="lg" className="text-center py-12 space-y-4">
              <div className="w-16 h-16 bg-violet-600/10 border border-violet-500/20 rounded-2xl flex items-center justify-center mx-auto">
                <TrendingUp className="w-8 h-8 text-white/40" />
              </div>
              <div className="space-y-2">
                <p className="font-medium text-white/70">No rankings yet</p>
                <p className="text-sm text-white/50">
                  Start your first ranking to see it appear here
                </p>
              </div>
              <Link to="/browse">
                <Button variant="primary" size="sm">
                  Start Ranking
                </Button>
              </Link>
            </Card>
          )}
        </motion.div>

        {/* Your Lists Section */}
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Your Lists</h2>
            <p className="text-white/60">
              Custom lists you've created
            </p>
          </div>

          {!loading && lists.length > 0 ? (
            <div className="space-y-3">
              {lists.map((list) => (
                <div key={list.id} className="flex items-center gap-2">
                  <Link to={`/ranking/preset/${list.id}`} className="flex-1">
                    <Card padding="lg" hover className="flex items-center justify-between">
                      <div className="space-y-1 flex-1">
                        <h3 className="font-semibold text-white">{list.title}</h3>
                        <p className="text-xs text-white/50">
                          {list.category} • {list.itemCount} items • {new Date(list.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-violet-400 text-sm font-medium">Rank →</div>
                    </Card>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate('/create', { state: { editList: list } });
                    }}
                    className="p-2.5 rounded-lg text-white/20 hover:text-violet-400 hover:bg-violet-500/10 transition-colors flex-shrink-0"
                    title="Edit list"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm('Delete this list?')) {
                        try {
                          const res = await deleteList(list.id);
                          if (!res.error) {
                            setLists(prev => prev.filter(l => l.id !== list.id));
                          } else {
                            console.error('Delete failed:', res.error);
                            alert('Failed to delete list. Please try again.');
                          }
                        } catch (err) {
                          console.error('Delete error:', err);
                          alert('Failed to delete list. Please try again.');
                        }
                      }
                    }}
                    className="p-2.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                    title="Delete list"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Card padding="lg" className="text-center py-12 space-y-4">
              <div className="w-16 h-16 bg-violet-600/10 border border-violet-500/20 rounded-2xl flex items-center justify-center mx-auto">
                <Grid3X3 className="w-8 h-8 text-white/40" />
              </div>
              <div className="space-y-2">
                <p className="font-medium text-white/70">No saved lists yet</p>
                <p className="text-sm text-white/50">
                  Create your first custom list to get started
                </p>
              </div>
              <Link to="/create">
                <Button variant="primary" size="sm">
                  Create a List
                </Button>
              </Link>
            </Card>
          )}
        </motion.div>

      </div>
    </PageLayout>
  );
}
