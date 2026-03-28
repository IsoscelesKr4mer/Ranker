import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, ThumbsUp, Zap } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { PageLayout } from '@/components/layout';
import { PRESET_LISTS } from '@/data/presets';

const CATEGORIES = ['All', 'Movies', 'TV', 'Games', 'Music', 'Other'];

export default function Community() {
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Filter lists based on category
  const filteredLists = useMemo(() => {
    if (selectedCategory === 'All') {
      return PRESET_LISTS;
    }
    return PRESET_LISTS.filter(list => list.category === selectedCategory);
  }, [selectedCategory]);

  // Generate random upvote count for demo
  const getUpvotes = (id: string) => {
    const seed = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return Math.floor((seed % 500) + 50);
  };

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

        {/* Community Lists Grid */}
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
                      by Ranker Team
                    </p>
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-3 text-xs text-white/50 py-2 border-y border-white/[0.06]">
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="w-3 h-3" />
                      <span>{getUpvotes(list.id)} votes</span>
                    </div>
                    <span>•</span>
                    <span>{list.itemCount} items</span>
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

        {/* No Results State */}
        {filteredLists.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card padding="lg" className="text-center py-12">
              <div className="space-y-3">
                <p className="font-medium text-white/70">No lists in this category</p>
                <p className="text-sm text-white/50">
                  Try selecting a different category or check back soon
                </p>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Coming Soon Footer */}
        <motion.div
          className="text-center py-8 border-t border-white/[0.06]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <p className="text-white/50 text-sm">
            More lists coming soon as community members submit their own!
          </p>
        </motion.div>
      </div>
    </PageLayout>
  );
}
