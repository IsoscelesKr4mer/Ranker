import { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Card } from '@/components/ui';
import { PRESET_LISTS } from '@/data/presets';
import { List, GitCompareArrows, Trophy, ExternalLink } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function Landing() {
  const navigate = useNavigate();
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const { user, status } = useAuthStore();

  const scrollToHowItWorks = () => {
    howItWorksRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Use real poster images for the hero demo
  const heroItems = PRESET_LISTS[0].items;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-bg-primary/80 backdrop-blur-xl border-b border-white/[0.07]">
        <div className="max-w-4xl mx-auto px-8 sm:px-12 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-md shadow-violet-600/30">
              R
            </div>
            <span
              className="text-base font-bold text-white/90"
              style={{ fontFamily: 'var(--font-family-display)' }}
            >
              Ranker
            </span>
          </div>
          {status === 'authenticated' && user ? (
            <Link to="/dashboard">
              <Button variant="secondary" size="sm">Dashboard</Button>
            </Link>
          ) : status !== 'loading' ? (
            <Link to="/auth">
              <Button variant="secondary" size="sm">Sign In</Button>
            </Link>
          ) : null}
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative flex items-center justify-center px-8 sm:px-12 pt-14 sm:pt-20 pb-14 sm:pb-18">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
          className="relative max-w-4xl mx-auto text-center z-10"
        >
          <h1
            className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white mb-5 leading-[1.2] tracking-tight px-1"
            style={{ fontFamily: 'var(--font-family-display)' }}
          >
            Rank{' '}
            <span className="bg-gradient-to-r from-violet-400 via-violet-300 to-purple-300 bg-clip-text text-transparent pb-1 inline-block">
              anything.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-white/65 mb-10 max-w-xl mx-auto leading-relaxed">
            Movies, games, music — settle the debate with science.
            One choice at a time.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12 sm:mb-16">
            <Button
              size="lg"
              onClick={() => navigate('/browse')}
            >
              Start Ranking
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={scrollToHowItWorks}
            >
              How it works
            </Button>
          </div>

          {/* Hero VS Demo — real poster cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="relative flex items-center justify-center gap-0"
          >
            {/* Left poster */}
            <motion.div
              animate={{ x: [-6, 0, -6] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="relative w-36 sm:w-44 md:w-52 rounded-2xl overflow-hidden border border-white/[0.14] flex-shrink-0"
              style={{ boxShadow: '0 24px 60px -8px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)' }}
            >
              {heroItems[0]?.imageUrl && (
                <>
                  <img
                    src={heroItems[0].imageUrl}
                    alt={heroItems[0].title}
                    className="w-full object-cover"
                    style={{ aspectRatio: '2/3' }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-xs font-semibold text-white leading-tight truncate">{heroItems[0].title}</p>
                    <p className="text-[10px] text-white/50 mt-0.5">{heroItems[0].subtitle}</p>
                  </div>
                </>
              )}
            </motion.div>

            {/* VS badge */}
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              className="relative z-10 mx-3 sm:mx-4 w-10 h-10 rounded-full bg-[#06060e]/90 border border-white/[0.14] backdrop-blur-sm flex items-center justify-center flex-shrink-0"
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
            >
              <span className="text-[10px] font-bold text-white/50 tracking-widest">VS</span>
            </motion.div>

            {/* Right poster */}
            <motion.div
              animate={{ x: [6, 0, 6] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="relative w-36 sm:w-44 md:w-52 rounded-2xl overflow-hidden border border-white/[0.14] flex-shrink-0"
              style={{ boxShadow: '0 24px 60px -8px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)' }}
            >
              {heroItems[5]?.imageUrl && (
                <>
                  <img
                    src={heroItems[5].imageUrl}
                    alt={heroItems[5].title}
                    className="w-full object-cover"
                    style={{ aspectRatio: '2/3' }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-xs font-semibold text-white leading-tight truncate">{heroItems[5].title}</p>
                    <p className="text-[10px] text-white/50 mt-0.5">{heroItems[5].subtitle}</p>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────── */}
      <section
        ref={howItWorksRef}
        className="max-w-4xl mx-auto px-8 sm:px-12 py-14 sm:py-20 scroll-mt-14"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.55 }}
          className="text-center mb-14"
        >
          <h2
            className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight"
            style={{ fontFamily: 'var(--font-family-display)' }}
          >
            How it works
          </h2>
          <p className="text-base text-white/55">Three steps to your definitive ranking</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: List,
              title: 'Pick a list',
              description: 'Choose from movies, games, music, or create your own custom list to rank.',
              step: 1,
            },
            {
              icon: GitCompareArrows,
              title: 'Make choices',
              description: 'Compare two items at a time. Our algorithm learns your preferences with each choice.',
              step: 2,
            },
            {
              icon: Trophy,
              title: 'Get your ranking',
              description: 'See your personalized ranking built by a proven merge sort algorithm. Share it.',
              step: 3,
            },
          ].map(({ icon: Icon, title, description, step }) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.55, delay: step * 0.08 }}
            >
              <Card hover className="h-full flex flex-col items-center text-center" padding="lg">
                <div className="w-12 h-12 bg-violet-600/15 border border-violet-500/25 rounded-xl flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-violet-400" />
                </div>
                <div className="text-[11px] font-bold text-violet-500/70 tracking-widest uppercase mb-2">
                  Step {step}
                </div>
                <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
                  {title}
                </h3>
                <p className="text-sm text-white/55 leading-relaxed">
                  {description}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Popular Lists ─────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-8 sm:px-12 py-14 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.55 }}
          className="text-center mb-14"
        >
          <h2
            className="text-4xl sm:text-5xl font-bold text-white mb-5 tracking-tight"
            style={{ fontFamily: 'var(--font-family-display)' }}
          >
            Popular lists
          </h2>
          <p className="text-lg text-white/55">Start ranking from these community favorites</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {PRESET_LISTS.slice(0, 6).map((list, idx) => {
            const items = list.items.slice(0, 3);

            return (
              <motion.div
                key={list.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.55, delay: idx * 0.05 }}
              >
                <Link to={`/ranking/preset/${list.id}`}>
                  <Card
                    hover
                    padding="none"
                    className="overflow-hidden h-full flex flex-col group"
                  >
                    {/* Cinematic collage header */}
                    <div className="relative overflow-hidden rounded-t-2xl bg-black/70" style={{ height: 200 }}>
                      {/* Blurred backdrop */}
                      {items[0]?.imageUrl && (
                        <div
                          className="absolute inset-0 scale-125 blur-xl opacity-35"
                          style={{
                            backgroundImage: `url(${items[0].imageUrl})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        />
                      )}
                      {/* Three fanned posters */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        {items.map((item, i) => {
                          const fan = [
                            { rotate: -8, x: -44, z: 1 },
                            { rotate: 0, x: 0, z: 3 },
                            { rotate: 8, x: 44, z: 1 },
                          ];
                          const f = fan[i] ?? fan[0];
                          return (
                            <div
                              key={item.id}
                              className="absolute transition-transform duration-300 group-hover:scale-105"
                              style={{
                                transform: `rotate(${f.rotate}deg) translateX(${f.x}px)`,
                                zIndex: f.z,
                                boxShadow: '0 8px 28px rgba(0,0,0,0.65)',
                              }}
                            >
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.title}
                                  className="w-[76px] h-[112px] object-cover rounded-xl border border-white/[0.12]"
                                />
                              ) : (
                                <div className="w-[76px] h-[112px] rounded-xl bg-violet-600/20 border border-violet-500/20" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Card content */}
                    <div className="p-5 sm:p-6 flex-1 flex flex-col">
                      <h3 className="text-base font-bold text-white/90 mb-3 line-clamp-1 group-hover:text-violet-300 transition-colors">
                        {list.title}
                      </h3>
                      <p className="text-sm text-white/50 mb-5 line-clamp-2 leading-relaxed">
                        {list.description || `${list.itemCount} items to rank`}
                      </p>
                      <div className="mt-auto flex items-center justify-between">
                        <span className="text-[11px] text-white/35">{list.category}</span>
                        <span className="text-[11px] font-semibold text-violet-400/70">{list.itemCount} items</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center mt-12"
        >
          <Link to="/browse">
            <Button variant="secondary" size="md">Explore more lists</Button>
          </Link>
        </motion.div>
      </section>

      {/* ── Community ─────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-8 sm:px-12 py-14 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          className="flex flex-col items-center text-center"
        >
          <h2
            className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight"
            style={{ fontFamily: 'var(--font-family-display)' }}
          >
            Join the community
          </h2>
          <p className="text-base text-white/55 mb-8 max-w-xl">
            See what others are ranking, share your lists, and discover new perspectives.
          </p>
          <Link to="/community">
            <Button size="lg">View community rankings</Button>
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.07]">
        <div className="max-w-4xl mx-auto px-8 sm:px-12 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                R
              </div>
              <div>
                <p className="text-white/85 font-semibold text-sm">Ranker</p>
                <p className="text-[11px] text-white/35">Built with merge sort</p>
              </div>
            </div>

            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="text-xs">GitHub</span>
            </a>
          </div>

          <div className="border-t border-white/[0.06] mt-8 pt-6 text-center text-xs text-white/25">
            <p>&copy; 2026 Ranker. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}