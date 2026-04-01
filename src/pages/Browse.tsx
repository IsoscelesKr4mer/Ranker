import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Import, Plus, ArrowRight } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { PageLayout } from '@/components/layout';
import { PRESET_LISTS } from '@/data/presets';
import { isValidLetterboxdUrl } from '@/lib/letterboxd';

type TabType = 'presets' | 'letterboxd' | 'create';

const CATEGORIES = ['All', 'Movies', 'TV', 'Games', 'Music', 'Books'];

export default function Browse() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('presets');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [letterboxdUrl, setLetterboxdUrl] = useState('');
  const [urlValidation, setUrlValidation] = useState<'idle' | 'valid' | 'invalid'>('idle');

  const filteredPresets = useMemo(() => {
    return PRESET_LISTS.filter(list => {
      const matchesSearch = list.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        list.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || list.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const handleLetterboxdUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setLetterboxdUrl(url);
    setUrlValidation('idle');
  };

  const handleValidateUrl = () => {
    if (isValidLetterboxdUrl(letterboxdUrl)) {
      setUrlValidation('valid');
    } else {
      setUrlValidation('invalid');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.07, delayChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.28 },
    },
  };

  return (
    <PageLayout maxWidth="xl">
      <div className="space-y-10">
        {/* Header */}
        <div className="space-y-2">
          <h1
            className="text-4xl sm:text-5xl font-bold text-white tracking-tight"
            style={{ fontFamily: 'var(--font-family-display)' }}
          >
            Find Lists to Rank
          </h1>
          <p className="text-white/55 text-base">Presets, Letterboxd imports, or build your own</p>
        </div>

        {/* Tab Pills */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'presets' as TabType, label: 'Presets' },
            { id: 'letterboxd' as TabType, label: 'Letterboxd', icon: <Import className="w-3.5 h-3.5" /> },
            { id: 'create' as TabType, label: 'Create Custom', icon: <Plus className="w-3.5 h-3.5" /> },
          ].map(tab => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                inline-flex items-center gap-1.5 px-4 py-2 rounded-full
                font-semibold transition-all duration-150 text-sm
                ${activeTab === tab.id
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25'
                  : 'bg-white/[0.05] border border-white/[0.10] text-white/55 hover:text-white/80 hover:bg-white/[0.09] hover:border-white/[0.16]'
                }
              `}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {tab.icon}
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {/* Presets Tab */}
          {activeTab === 'presets' && (
            <motion.div
              className="space-y-8"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {/* Search and Filter */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 w-4 h-4 text-white/28 pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Search lists..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-11"
                  />
                </div>

                {/* Category Pills */}
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.map(category => (
                    <motion.button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`
                        px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150
                        ${selectedCategory === category
                          ? 'bg-violet-600/20 border border-violet-500/45 text-violet-300'
                          : 'bg-white/[0.04] border border-white/[0.09] text-white/50 hover:text-white/75 hover:border-white/[0.16]'
                        }
                      `}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                    >
                      {category}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Preset Grid */}
              {filteredPresets.length > 0 ? (
                <motion.div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {filteredPresets.map(list => (
                    <motion.div key={list.id} variants={itemVariants}>
                      <Link to={`/ranking/preset/${list.id}`}>
                        <Card hover padding="none" className="h-full flex flex-col group cursor-pointer overflow-hidden">
                          {/* Cinematic collage header */}
                          <div
                            className="relative overflow-hidden rounded-t-2xl bg-black/70 flex-shrink-0"
                            style={{ height: 180 }}
                          >
                            {/* Blurred backdrop */}
                            {list.items[0]?.imageUrl && (
                              <div
                                className="absolute inset-0 scale-125 blur-xl opacity-30"
                                style={{
                                  backgroundImage: `url(${list.items[0].imageUrl})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                }}
                              />
                            )}
                            {/* Three fanned posters */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              {list.items.slice(0, 3).map((item, i) => {
                                const fan = [
                                  { rotate: -9, x: -34, z: 1 },
                                  { rotate: 0, x: 0, z: 3 },
                                  { rotate: 8, x: 34, z: 1 },
                                ];
                                const f = fan[i] ?? fan[0];
                                return (
                                  <div
                                    key={item.id}
                                    className="absolute transition-transform duration-300 group-hover:scale-105"
                                    style={{
                                      transform: `rotate(${f.rotate}deg) translateX(${f.x}px)`,
                                      zIndex: f.z,
                                      boxShadow: '0 6px 22px rgba(0,0,0,0.65)',
                                    }}
                                  >
                                    {item.imageUrl ? (
                                      <img
                                        src={item.imageUrl}
                                        alt={item.title}
                                        className="w-[60px] h-[90px] object-cover rounded-lg border border-white/[0.12]"
                                      />
                                    ) : (
                                      <div className="w-[60px] h-[90px] rounded-lg bg-violet-600/20 border border-violet-500/20" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* List Info */}
                          <div className="p-6 flex-1 flex flex-col space-y-3">
                            <div className="space-y-1.5">
                              <h3 className="font-bold text-white/90 text-base line-clamp-1 group-hover:text-violet-300 transition-colors leading-tight">
                                {list.title}
                              </h3>
                              <p className="text-xs text-white/45 line-clamp-2 leading-relaxed">
                                {list.description}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 mt-auto pt-1">
                              <span className="inline-flex items-center px-2.5 py-1 bg-violet-600/15 border border-violet-500/25 rounded-full text-[11px] font-semibold text-violet-300/80">
                                {list.itemCount} items
                              </span>
                              <span className="inline-flex items-center px-2.5 py-1 bg-white/[0.04] border border-white/[0.08] rounded-full text-[11px] text-white/42">
                                {list.category}
                              </span>
                            </div>
                          </div>
                        </Card>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <Card className="p-12 text-center">
                  <p className="text-white/45 text-sm">No lists found matching your search.</p>
                </Card>
              )}
            </motion.div>
          )}

          {/* Letterboxd Tab */}
          {activeTab === 'letterboxd' && (
            <motion.div
              className="max-w-lg mx-auto space-y-8"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="space-y-4">
                <p className="text-white/55 text-sm leading-relaxed">
                  Paste a Letterboxd list URL to import it. Works with public lists, watchlists, and film collections.
                </p>

                <div className="space-y-2">
                  <Input
                    type="url"
                    placeholder="https://letterboxd.com/username/list/list-name/"
                    value={letterboxdUrl}
                    onChange={handleLetterboxdUrlChange}
                    onKeyDown={e => e.key === 'Enter' && handleValidateUrl()}
                  />

                  <Button onClick={handleValidateUrl} variant="secondary" fullWidth>
                    Validate URL
                  </Button>

                  {urlValidation === 'valid' && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 bg-green-500/10 border border-green-500/25 rounded-xl text-green-300 text-sm flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" />
                      Valid Letterboxd URL!
                    </motion.div>
                  )}

                  {urlValidation === 'invalid' && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl text-red-300 text-sm flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                      Invalid URL. Please enter a valid Letterboxd link.
                    </motion.div>
                  )}

                  {urlValidation === 'valid' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-3 mt-2"
                    >
                      <Button
                        onClick={() => {
                          navigate('/create', {
                            state: { letterboxdUrl },
                          });
                        }}
                        variant="primary"
                        fullWidth
                      >
                        <Import className="w-4 h-4" />
                        Import to Create List
                      </Button>
                    </motion.div>
                  )}
                </div>

                <div className="pt-4 space-y-2 border-t border-white/[0.07]">
                  <p className="text-xs text-white/38 font-semibold">Example URLs:</p>
                  <div className="space-y-1 text-xs text-white/28 font-mono">
                    <p>letterboxd.com/username/list/list-name/</p>
                    <p>letterboxd.com/username/watchlist/</p>
                    <p>letterboxd.com/username/films/</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Create Custom Tab */}
          {activeTab === 'create' && (
            <motion.div
              className="max-w-lg mx-auto"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="space-y-6 p-8 text-center">
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-violet-600/15 border border-violet-500/25 rounded-xl flex items-center justify-center mx-auto">
                    <Plus className="w-5 h-5 text-violet-400" />
                  </div>
                  <h3
                    className="text-xl font-bold text-white tracking-tight"
                    style={{ fontFamily: 'var(--font-family-display)' }}
                  >
                    Create Your Own List
                  </h3>
                  <p className="text-white/55 text-sm leading-relaxed">
                    Build a custom ranking list of anything you want. Movies, games, books, people, ideas, or anything else!
                  </p>
                </div>

                <Link to="/create">
                  <Button variant="primary" fullWidth size="lg" className="mt-2">
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}