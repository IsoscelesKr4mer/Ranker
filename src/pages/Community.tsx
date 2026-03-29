import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Zap, Users } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { PageLayout } from '@/components/layout';
import { getCommunityLists } from '@/lib/database';
import type { RankList } from '@/types';

const CATEGORIES = ['All', 'Movies', 'TV', 'Games', 'Music', 'Other'];

export default function Community() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [lists, setLists] = useState<RankList[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCommunityLists().then((data) => {
      console.log('Community lists loaded:', data.length, data);
      setLists(data);
      setLoading(false);
    }).catch((err) => {
      console.error('Community lists fetch error:', err);
      setLoading(false);
    });
  }, []);

  const filteredLists = useMemo(() => {
    if (selectedCategory === 'All') return lists;
    return lists.filter(list => list.category === selectedCategory);
  }, [lists, selectedCategory]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
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

  return (
    <PageLayout maxWidth="xl">
      <div className="space-y-12 py-8">
        {/* Header */}
        <motion.div
          className="space-y-3 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-4xl sm:text-5xl font-bold text-white">
            Community Lists
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Discover lists created by the community and start ranking
          </p>
        </motion.div>

        {/* Submit Your List CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Link to="/create">
            <Card hover className="p-8 bg-gradient-to-r from-violet-600/10 to-violet-500/10 border border-violet-500/30 group">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-white group-hover:text-violet-300 transition-colors">
                    Have a list idea?
                  </h3>
                  <p className="text-white/60 text-sm">
                    Submit your own ranking list and share it with the community
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-violet-600/30 flex items-center justify-center group-hover:bg-violet-600/50 transition-colors">
                    <Plus className="w-6 h-6 text-violet-300" />
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(category => (
              <motion.button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                  ${selectedCategory === category
                    ? 'bg-violet-600/30 border border-violet-500/60 text-violet-300'
                    : 'bg-white/[0.03] border border-white/[0.08] text-white/60 hover:text-white/80 hover:bg-white/[0.06]'
                  }
                `}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {category}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-violet-400 animate-pulse" />
              <span className="text-sm text-white/30">Loading community lists...</span>
            </div>
          </div>
        )}

        {/* Community Lists Grid */}
        {!loading && filteredLists.length > 0 && (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {filteredLists.map(list => (
              <motion.div key={list.id} variants={itemVariants}>
                <Card hover className="h-full flex flex-col gap-4 group cursor-pointer overflow-hidden">
                  {/* 2x2 Item Grid */}
                  <div className="grid grid-cols-2 gap-2 aspect-square bg-white/[0.02] rounded-lg p-2 overflow-hidden">
                    {list.items.slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        className="bg-white/[0.05] rounded-md overflow-hidden"
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-violet-500/10 to-violet-500/5 flex items-center justify-center">
                            <span className="text-xs text-white/30 text-center px-1">
                              {item.title.substring(0, 10)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* List Info */}
                  <div className="space-y-3 flex-1 flex flex-col">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-white/90 line-clamp-2 group-hover:text-violet-300 transition-colors">
                        {list.title}
                      </h3>
                      <p className="text-xs text-white/50">
                        by {list.creatorName || 'Community Member'}
                      </p>
                    </div>

                    {/* Stats Row */}
                    <div className="flex items-center gap-3 text-xs text-white/50 py-2 border-y border-white/[0.06]">
                      <span>{list.itemCount} items</span>
                      <span>•</span>
                      <span>{list.category}</span>
                    </div>

                    {/* Badges and Button */}
                    <div className="flex items-center justify-between gap-2 mt-auto pt-2">
                      <span className="inline-block px-2.5 py-1 bg-violet-600/20 border border-violet-500/30 rounded-full text-xs font-medium text-violet-300">
                        {list.category}
                      </span>
                    </div>

                    {/* Rank Button */}
                    <Link to={`/ranking/preset/${list.id}`} className="w-full">
                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        className="mt-2 gap-1"
                      >
                        <Zap className="w-3 h-3" />
                        Rank This
                      </Button>
                    </Link>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && filteredLists.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card padding="lg" className="text-center py-12">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-violet-600/10 border border-violet-500/20 rounded-2xl flex items-center justify-center mx-auto">
                  <Users className="w-8 h-8 text-white/40" />
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-white/70">
                    {selectedCategory === 'All'
                      ? 'No community lists yet'
                      : `No ${selectedCategory} lists yet`}
                  </p>
                  <p className="text-sm text-white/50">
                    Be the first to create one! Import from Letterboxd or build your own.
                  </p>
                </div>
                <Link to="/create">
                  <Button variant="primary" size="sm">
                    Create a List
                  </Button>
                </Link>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Footer */}
        <motion.div
          className="text-center py-8 border-t border-white/[0.06]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <p className="text-white/50 text-sm">
            Lists here are created by the community. Import from Letterboxd or create your own to share!
          </p>
        </motion.div>
      </div>
    </PageLayout>
  );
}
