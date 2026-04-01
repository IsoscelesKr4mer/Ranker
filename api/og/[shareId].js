import { ImageResponse } from '@vercel/og';
import React from 'react';

export const config = { runtime: 'edge' };

const MEDAL_COLORS  = ['#d4a017', '#8fa3b8', '#b8764a', 'rgba(255,255,255,0.38)', 'rgba(255,255,255,0.38)'];
const MEDAL_LABELS  = ['★ Champion', 'Runner-Up', 'Third Place', '', ''];
const MEDAL_BGS     = ['rgba(212,160,23,0.09)', 'transparent', 'transparent', 'transparent', 'transparent'];
const MEDAL_BORDERS = ['rgba(212,160,23,0.55)', 'rgba(143,163,184,0.3)', 'rgba(184,118,74,0.3)', 'transparent', 'transparent'];

export default async function handler(req) {
  const url     = new URL(req.url);
  const parts   = url.pathname.split('/').filter(Boolean);
  const shareId = parts[parts.length - 1];

  if (!shareId) return new Response('Not found', { status: 404 });

  const supabaseUrl     = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response('Server misconfigured', { status: 500 });
  }

  const dbRes = await fetch(
    `${supabaseUrl}/rest/v1/ranking_results?share_id=eq.${encodeURIComponent(shareId)}&is_public=eq.true&select=list_title,results`,
    { headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` } }
  );

  const data = await dbRes.json();
  const row  = data[0];
  if (!row) return new Response('Not found', { status: 404 });

  const { list_title, results } = row;
  const top5 = results.slice(0, 5);

  const e = React.createElement;

  const itemRows = top5.map((item, idx) =>
    e('div', {
      key: idx,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        padding: idx === 0 ? '14px 18px' : '9px 18px',
        background: MEDAL_BGS[idx],
        borderRadius: '10px',
        borderLeft: `3px solid ${MEDAL_BORDERS[idx]}`,
      },
    },
      // Rank number
      e('div', {
        style: {
          fontSize: idx === 0 ? '32px' : '20px',
          fontWeight: 900,
          color: MEDAL_COLORS[idx],
          width: '52px',
          textAlign: 'right',
          letterSpacing: '-1px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
        },
      }, String(idx + 1).padStart(2, '0')),
      // Vertical rule
      e('div', { style: { width: '1px', height: '28px', background: 'rgba(255,255,255,0.08)', display: 'flex' } }),
      // Text block
      e('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' } },
        e('div', {
          style: {
            fontSize: idx === 0 ? '22px' : '18px',
            fontWeight: idx === 0 ? 700 : 600,
            color: idx === 0 ? '#ffffff' : 'rgba(255,255,255,0.82)',
            display: 'flex',
          },
        }, item.title),
        item.subtitle
          ? e('div', { style: { fontSize: '13px', color: 'rgba(255,255,255,0.36)', marginTop: '2px', display: 'flex' } }, item.subtitle)
          : null
      ),
      // Medal label
      MEDAL_LABELS[idx]
        ? e('div', {
            style: {
              fontSize: '10px',
              fontWeight: 700,
              color: MEDAL_COLORS[idx],
              letterSpacing: '2px',
              display: 'flex',
              alignItems: 'center',
            },
          }, MEDAL_LABELS[idx])
        : null
    )
  );

  const moreRow = results.length > 5
    ? e('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          padding: '8px 18px',
          color: 'rgba(255,255,255,0.28)',
          fontSize: '14px',
          fontStyle: 'italic',
          gap: '20px',
        },
      },
        e('div', { style: { width: '52px', display: 'flex' } }),
        e('div', { style: { width: '1px', height: '20px', background: 'rgba(255,255,255,0.06)', display: 'flex' } }),
        e('div', { style: { display: 'flex' } },
          `+ ${results.length - 5} more item${results.length - 5 !== 1 ? 's' : ''}`
        )
      )
    : null;

  const root = e('div', {
    style: {
      width: '1200px',
      height: '630px',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(145deg, #0a0815 0%, #07070f 55%, #0e0b1c 100%)',
      color: '#ffffff',
      padding: '56px 68px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'relative',
    },
  },
    // Purple glow top-left
    e('div', {
      style: {
        position: 'absolute', top: '-60px', left: '-40px',
        width: '480px', height: '480px',
        background: 'radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 70%)',
        display: 'flex',
      },
    }),
    // Gold glow bottom-right
    e('div', {
      style: {
        position: 'absolute', bottom: '-40px', right: '-20px',
        width: '360px', height: '360px',
        background: 'radial-gradient(circle, rgba(212,160,23,0.1) 0%, transparent 70%)',
        display: 'flex',
      },
    }),
    // Header
    e('div', {
      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', position: 'relative' },
    },
      e('div', { style: { display: 'flex', flexDirection: 'column', maxWidth: '900px' } },
        e('div', {
          style: { fontSize: '11px', fontWeight: 700, letterSpacing: '4px', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', marginBottom: '10px', display: 'flex' },
        }, 'MY RANKING'),
        e('div', {
          style: { fontSize: '42px', fontWeight: 800, color: '#ffffff', lineHeight: 1.1, display: 'flex' },
        }, list_title)
      ),
      e('div', {
        style: { fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.15)', letterSpacing: '4px', display: 'flex' },
      }, 'RANKER')
    ),
    // Divider
    e('div', { style: { height: '1px', background: 'rgba(255,255,255,0.1)', marginBottom: '18px', display: 'flex' } }),
    // Items
    e('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 } },
      ...itemRows,
      moreRow
    ),
    // Footer
    e('div', { style: { display: 'flex', alignItems: 'center', gap: '16px', marginTop: '14px', position: 'relative' } },
      e('div', { style: { height: '1px', flex: 1, background: 'rgba(255,255,255,0.06)', display: 'flex' } }),
      e('div', { style: { fontSize: '12px', color: 'rgba(255,255,255,0.18)', letterSpacing: '1px', display: 'flex' } }, 'ranker.app')
    )
  );

  return new ImageResponse(root, { width: 1200, height: 630 });
}
