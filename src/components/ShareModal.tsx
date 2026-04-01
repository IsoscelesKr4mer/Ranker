import { useRef, useState, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { motion } from 'framer-motion';
import { Download, Link2, Share2, Check, Loader2, ChevronRight } from 'lucide-react';
import { Modal } from '@/components/ui';
import type { RankItem } from '@/types';

// ─── Hidden share card (captured off-screen for image export) ───────────────

interface ShareCardProps {
  items: RankItem[];
  listTitle: string;
}

function ShareCardInner({ items, listTitle }: ShareCardProps) {
  const top5 = items.slice(0, 5);

  const rankMeta = [
    { color: '#d4a017', label: '★ Champion', bg: 'rgba(212,160,23,0.09)', border: 'rgba(212,160,23,0.55)' },
    { color: '#8fa3b8', label: 'Runner-Up',  bg: 'transparent',           border: 'rgba(143,163,184,0.3)' },
    { color: '#b8764a', label: 'Third Place', bg: 'transparent',           border: 'rgba(184,118,74,0.3)' },
    { color: 'rgba(255,255,255,0.3)', label: '', bg: 'transparent', border: 'transparent' },
    { color: 'rgba(255,255,255,0.3)', label: '', bg: 'transparent', border: 'transparent' },
  ];

  return (
    <div
      style={{
        width: '1200px',
        height: '630px',
        background: 'linear-gradient(145deg, #0a0815 0%, #07070f 55%, #0e0b1c 100%)',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        color: '#ffffff',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* Atmospheric glows */}
      <div style={{ position: 'absolute', top: '-120px', left: '-80px', width: '520px', height: '520px', background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-80px', right: '-40px', width: '380px', height: '360px', background: 'radial-gradient(circle, rgba(212,160,23,0.09) 0%, transparent 70%)', pointerEvents: 'none' }} />
      {/* Noise grain */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.025, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', pointerEvents: 'none' }} />

      <div style={{ padding: '56px 68px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', marginBottom: '10px' }}>
              My Ranking
            </div>
            <div style={{ fontSize: '38px', fontWeight: 800, color: '#ffffff', lineHeight: 1.08, maxWidth: '780px', letterSpacing: '-0.01em' }}>
              {listTitle}
            </div>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.2em', textTransform: 'uppercase', paddingTop: '4px' }}>
            RANKER
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'linear-gradient(to right, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 60%, transparent 100%)', marginBottom: '22px' }} />

        {/* Items */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {top5.map((item, idx) => {
            const meta = rankMeta[idx] ?? rankMeta[3];
            const isFirst = idx === 0;

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '22px',
                  padding: isFirst ? '15px 18px' : '10px 18px',
                  background: meta.bg,
                  borderRadius: '10px',
                  borderLeft: `3px solid ${meta.border}`,
                }}
              >
                {/* Rank number */}
                <div style={{
                  fontSize: isFirst ? '34px' : '22px',
                  fontWeight: 900,
                  color: meta.color,
                  lineHeight: 1,
                  width: '56px',
                  textAlign: 'right',
                  flexShrink: 0,
                  letterSpacing: '-0.02em',
                }}>
                  {String(idx + 1).padStart(2, '0')}
                </div>

                {/* Divider */}
                <div style={{ width: '1px', height: isFirst ? '36px' : '28px', background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: isFirst ? '24px' : '19px',
                    fontWeight: isFirst ? 700 : 600,
                    color: isFirst ? '#ffffff' : 'rgba(255,255,255,0.82)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.2,
                  }}>
                    {item.title}
                  </div>
                  {item.subtitle && (
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.36)', marginTop: '3px' }}>
                      {item.subtitle}
                    </div>
                  )}
                </div>

                {/* Medal label */}
                {meta.label && (
                  <div style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: meta.color,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}>
                    {meta.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '20px' }}>
          <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em' }}>
            Make your own ranking at ranker.app
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Share option row ────────────────────────────────────────────────────────

type OptionState = 'idle' | 'loading' | 'done' | 'error';

interface ShareOptionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  state?: OptionState;
  disabled?: boolean;
  onClick: () => void;
  accentColor?: string;
}

function ShareOption({ icon, title, description, state = 'idle', disabled, onClick, accentColor }: ShareOptionProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || state === 'loading'}
      whileTap={{ scale: 0.98 }}
      className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
      onMouseEnter={(e) => { if (!disabled && state !== 'loading') e.currentTarget.style.background = 'rgba(255,255,255,0.065)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: accentColor ? `${accentColor}18` : 'rgba(255,255,255,0.06)', color: accentColor ?? 'rgba(255,255,255,0.7)' }}
      >
        {state === 'loading' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : state === 'done' ? (
          <Check className="w-4 h-4" style={{ color: '#4ade80' }} />
        ) : (
          icon
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white/90 leading-tight">{title}</p>
        <p className="text-xs text-white/38 mt-0.5 leading-snug">{description}</p>
      </div>

      {/* Arrow */}
      {state === 'idle' && (
        <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
      )}
    </motion.button>
  );
}

// ─── Main ShareModal ─────────────────────────────────────────────────────────

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  listTitle: string;
  items: RankItem[];
  shareLink: string | null;
  isSavingLink: boolean;
}

export function ShareModal({ isOpen, onClose, listTitle, items, shareLink, isSavingLink }: ShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [imgState, setImgState] = useState<OptionState>('idle');
  const [copyState, setCopyState] = useState<OptionState>('idle');
  const [xState, setXState] = useState<OptionState>('idle');
  const [nativeState, setNativeState] = useState<OptionState>('idle');

  const hasNativeShare = typeof navigator !== 'undefined' && Boolean(navigator.share);

  // ── Download image ──────────────────────────────────────────────────────
  const handleDownloadImage = useCallback(async () => {
    if (!cardRef.current) return;
    setImgState('loading');
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        skipFonts: false,
      });
      const link = document.createElement('a');
      link.download = `${listTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-ranking.png`;
      link.href = dataUrl;
      link.click();
      setImgState('done');
      setTimeout(() => setImgState('idle'), 2500);
    } catch (err) {
      console.error('Image generation failed:', err);
      setImgState('error');
      setTimeout(() => setImgState('idle'), 2500);
    }
  }, [listTitle]);

  // ── Copy link ───────────────────────────────────────────────────────────
  const handleCopyLink = useCallback(async () => {
    if (!shareLink) return;
    setCopyState('loading');
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopyState('done');
      setTimeout(() => setCopyState('idle'), 2500);
    } catch {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2500);
    }
  }, [shareLink]);

  // ── Share on X ──────────────────────────────────────────────────────────
  const handleShareX = useCallback(() => {
    if (!shareLink) return;
    setXState('loading');
    const text = encodeURIComponent(`My top picks for "${listTitle}" — check out my full ranking:`);
    const url = encodeURIComponent(shareLink);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener,noreferrer');
    setTimeout(() => {
      setXState('done');
      setTimeout(() => setXState('idle'), 2500);
    }, 500);
  }, [shareLink, listTitle]);

  // ── Native share ────────────────────────────────────────────────────────
  const handleNativeShare = useCallback(async () => {
    if (!shareLink || !navigator.share) return;
    setNativeState('loading');
    try {
      await navigator.share({
        title: `My ${listTitle} Ranking`,
        text: `Check out my top picks for "${listTitle}"`,
        url: shareLink,
      });
      setNativeState('done');
      setTimeout(() => setNativeState('idle'), 2500);
    } catch (err) {
      // User cancelled — not an error
      setNativeState('idle');
    }
  }, [shareLink, listTitle]);

  const linkPending = isSavingLink || !shareLink;

  return (
    <>
      {/* Hidden share card — rendered off-screen for image capture */}
      {isOpen && (
        <div
          style={{ position: 'fixed', left: '-9999px', top: '0', zIndex: -1, pointerEvents: 'none' }}
          aria-hidden
        >
          <div ref={cardRef}>
            <ShareCardInner items={items} listTitle={listTitle} />
          </div>
        </div>
      )}

      <Modal isOpen={isOpen} onClose={onClose} title="Share Your Ranking" size="sm">
        <div className="space-y-2">
          {/* Download image */}
          <ShareOption
            icon={<Download className="w-4 h-4" />}
            title="Download Image"
            description="Save as PNG — perfect for X, Instagram, anywhere"
            state={imgState}
            onClick={handleDownloadImage}
            accentColor="#7c3aed"
          />

          {/* Copy link */}
          <ShareOption
            icon={<Link2 className="w-4 h-4" />}
            title="Copy Link"
            description={linkPending ? 'Generating shareable link…' : 'Link copied to clipboard'}
            state={linkPending ? 'loading' : copyState}
            disabled={linkPending}
            onClick={handleCopyLink}
            accentColor="#3b82f6"
          />

          {/* Share on X */}
          <ShareOption
            icon={
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            }
            title="Share on X"
            description={linkPending ? 'Generating link first…' : `Post to your timeline`}
            state={linkPending ? 'loading' : xState}
            disabled={linkPending}
            onClick={handleShareX}
            accentColor="#ffffff"
          />

          {/* Native share — only shown on devices that support it */}
          {hasNativeShare && (
            <ShareOption
              icon={<Share2 className="w-4 h-4" />}
              title="More Options"
              description={linkPending ? 'Generating link first…' : 'Share via Messages, Mail, and more'}
              state={linkPending ? 'loading' : nativeState}
              disabled={linkPending}
              onClick={handleNativeShare}
              accentColor="#10b981"
            />
          )}
        </div>

        {/* Preview label */}
        <p className="text-[10px] text-white/20 text-center mt-5 tracking-wide uppercase">
          Image preview: {Math.min(items.length, 5)} of {items.length} items shown
        </p>
      </Modal>
    </>
  );
}
