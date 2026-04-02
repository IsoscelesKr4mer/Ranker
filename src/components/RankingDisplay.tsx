import { motion } from 'framer-motion';
import type { RankItem } from '@/types';

interface RankingDisplayProps {
  items: RankItem[];
}

// Only stagger-animate the first N items — beyond that the delay would be
// unbearably long (e.g. 60 items × 0.05s = 3s wait for the last row).
const ANIMATED_COUNT = 12;


export function RankingDisplay({ items }: RankingDisplayProps) {
  const first = items[0];
  const second = items[1];
  const third = items[2];
  const rest = items.slice(3);

  // Split remaining items into two columns
  const midpoint = Math.ceil(rest.length / 2);
  const leftCol = rest.slice(0, midpoint);
  const rightCol = rest.slice(midpoint);

  const renderRestItem = (item: RankItem, globalIdx: number, localIdx: number) => {
    const rowClass =
      'flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/[0.028] transition-colors duration-150 group';

    const rowContent = (
      <>
        {/* Rank number */}
        <div className="w-6 text-right flex-shrink-0">
          <span
            className="text-xs font-bold tabular-nums group-hover:text-white/40 transition-colors"
            style={{
              color: 'rgba(255,255,255,0.18)',
              fontFamily: 'var(--font-family-display)',
            }}
          >
            {String(globalIdx + 4).padStart(2, '0')}
          </span>
        </div>

        {/* Thumbnail — compact square */}
        {item.imageUrl ? (
          <div className="w-7 h-7 rounded overflow-hidden flex-shrink-0 bg-white/[0.05]">
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-7 h-7 rounded bg-violet-600/10 flex-shrink-0" />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white/75 text-[13px] truncate leading-tight">
            {item.title}
          </p>
        </div>
      </>
    );

    if (localIdx < ANIMATED_COUNT) {
      return (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.28,
            delay: 0.2 + localIdx * 0.04,
            ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
          }}
          className={rowClass}
        >
          {rowContent}
        </motion.div>
      );
    }

    return (
      <div key={item.id} className={rowClass}>
        {rowContent}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* ── #1 Champion — Full-width cinematic hero ── */}
      {first && (
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="relative overflow-hidden rounded-2xl border border-yellow-500/25"
            style={{
              background: 'rgba(10,8,4,0.97)',
              boxShadow:
                '0 0 0 1px rgba(212,175,55,0.1), 0 40px 80px -20px rgba(0,0,0,0.8)',
            }}
          >
            {/* Atmospheric blurred backdrop */}
            {first.imageUrl && (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${first.imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center 20%',
                  filter: 'blur(28px) saturate(0.5) brightness(0.8)',
                  transform: 'scale(1.18)',
                  opacity: 0.22,
                }}
              />
            )}
            {/* Dark overlays for legibility */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />
            {/* Gold left accent bar */}
            <div
              className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{
                background:
                  'linear-gradient(to bottom, rgba(240,192,64,1) 0%, rgba(212,160,30,0.6) 60%, transparent 100%)',
              }}
            />

            <div className="relative flex gap-5 sm:gap-7 p-5 sm:p-7">
              {/* Poster image */}
              {first.imageUrl && (
                <motion.div
                  className="flex-shrink-0 rounded-xl overflow-hidden w-28 sm:w-36 md:w-44"
                  style={{
                    aspectRatio: '2/3',
                    boxShadow:
                      '0 24px 64px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.07)',
                  }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                >
                  <img
                    src={first.imageUrl}
                    alt={first.title}
                    className="w-full h-full object-cover"
                  />
                </motion.div>
              )}

              {/* Text section */}
              <div className="flex-1 flex flex-col justify-end min-w-0 py-1">
                {/* Decorative "01" watermark */}
                <div
                  className="absolute right-4 top-3 leading-none select-none pointer-events-none"
                  style={{
                    fontFamily: 'var(--font-family-display)',
                    fontSize: 'clamp(72px, 20vw, 144px)',
                    fontWeight: 900,
                    color: 'rgba(240,192,64,0.055)',
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                  }}
                  aria-hidden
                >
                  01
                </div>

                <div className="space-y-3">
                  {/* Champion label */}
                  <p
                    className="text-sm sm:text-base font-bold tracking-[0.22em] uppercase"
                    style={{
                      color: '#c9973a',
                      fontFamily: 'var(--font-family-display)',
                    }}
                  >
                    ★&nbsp;&nbsp;Champion
                  </p>

                  {/* Thin gold rule */}
                  <div
                    className="w-12 h-px"
                    style={{ background: 'rgba(212,175,55,0.45)' }}
                  />

                  {/* Title */}
                  <h3
                    className="font-bold text-white leading-none"
                    style={{
                      fontFamily: 'var(--font-family-display)',
                      fontSize: 'clamp(2rem, 7vw, 3.5rem)',
                      textShadow: '0 2px 20px rgba(0,0,0,0.5)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {first.title}
                  </h3>

                  {/* Subtitle */}
                  {first.subtitle && (
                    <p className="text-white/45 text-base sm:text-lg">{first.subtitle}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── #2 and #3 — Prominent horizontal cards ── */}
      {(second || third) && (
        <motion.div
          className="grid grid-cols-2 gap-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* #2 Silver */}
          {second && (
            <div
              className="relative overflow-hidden rounded-xl border border-slate-400/18 flex gap-4 p-4 sm:p-5"
              style={{
                background: 'rgba(255,255,255,0.032)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              }}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-[2px]"
                style={{
                  background:
                    'linear-gradient(to bottom, rgba(148,163,184,0.75), rgba(100,116,139,0.15))',
                }}
              />
              {second.imageUrl && (
                <div
                  className="flex-shrink-0 rounded-lg overflow-hidden"
                  style={{ width: '72px', aspectRatio: '2/3' }}
                >
                  <img
                    src={second.imageUrl}
                    alt={second.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex flex-col justify-center min-w-0 gap-1.5">
                <p
                  className="text-[10px] sm:text-[11px] font-bold tracking-[0.18em] uppercase"
                  style={{
                    color: '#7a8fa6',
                    fontFamily: 'var(--font-family-display)',
                  }}
                >
                  Runner-Up
                </p>
                <p className="font-bold text-white/90 text-sm sm:text-base leading-snug line-clamp-3">
                  {second.title}
                </p>
                {second.subtitle && (
                  <p className="text-white/35 text-[11px] sm:text-xs">{second.subtitle}</p>
                )}
              </div>
            </div>
          )}

          {/* #3 Bronze */}
          {third && (
            <div
              className="relative overflow-hidden rounded-xl border border-orange-700/20 flex gap-4 p-4 sm:p-5"
              style={{
                background: 'rgba(255,255,255,0.032)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              }}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-[2px]"
                style={{
                  background:
                    'linear-gradient(to bottom, rgba(180,100,50,0.75), rgba(140,70,25,0.15))',
                }}
              />
              {third.imageUrl && (
                <div
                  className="flex-shrink-0 rounded-lg overflow-hidden"
                  style={{ width: '72px', aspectRatio: '2/3' }}
                >
                  <img
                    src={third.imageUrl}
                    alt={third.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex flex-col justify-center min-w-0 gap-1.5">
                <p
                  className="text-[10px] sm:text-[11px] font-bold tracking-[0.18em] uppercase"
                  style={{
                    color: '#9a6035',
                    fontFamily: 'var(--font-family-display)',
                  }}
                >
                  Third Place
                </p>
                <p className="font-bold text-white/90 text-sm sm:text-base leading-snug line-clamp-3">
                  {third.title}
                </p>
                {third.subtitle && (
                  <p className="text-white/35 text-[11px] sm:text-xs">{third.subtitle}</p>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Remaining rankings — 2-column grid ── */}
      {rest.length > 0 && (
        <div className="pt-1">
          <p
            className="text-[10px] font-bold tracking-[0.2em] uppercase px-1 mb-2"
            style={{ color: 'rgba(255,255,255,0.22)', fontFamily: 'var(--font-family-display)' }}
          >
            Also Ranked
          </p>
          <div
            className="rounded-xl overflow-hidden border border-white/[0.055] grid grid-cols-2"
            style={{ background: 'rgba(255,255,255,0.018)' }}
          >
            {/* Left column */}
            <div className="border-r border-white/[0.045]">
              {leftCol.map((item, idx) => renderRestItem(item, idx, idx))}
            </div>
            {/* Right column */}
            <div>
              {rightCol.map((item, idx) => renderRestItem(item, idx + midpoint, idx))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
