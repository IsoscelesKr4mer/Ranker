import { ImageResponse } from '@vercel/og';
import React from 'react';

export const config = { runtime: 'edge' } as const;

const MEDAL_COLORS  = ['#d4a017', '#8fa3b8', '#b8764a', 'rgba(255,255,255,0.38)', 'rgba(255,255,255,0.38)'];
const MEDAL_LABELS  = ['★ Champion', 'Runner-Up', 'Third Place', '', ''];
const MEDAL_BGS     = ['rgba(212,160,23,0.09)', 'transparent', 'transparent', 'transparent', 'transparent'];
const MEDAL_BORDERS = ['rgba(212,160,23,0.55)', 'rgba(143,163,184,0.3)', 'rgba(184,118,74,0.3)', 'transparent', 'transparent'];

interface RankItem { title: string; subtitle?: string }

type CSSProperties = Record<string, string | number>;

const e = React.createElement;

function div(style: CSSProperties, ...children: React.ReactNode[]): React.ReactElement {
  return e('div', { style }, ...children);
}

export default async function handler(req: Request): Promise<Response> {
  const url     = new URL(req.url);
  const parts   = url.pathname.split('/').filter(Boolean);
  const shareId = parts[parts.length - 1];

  if (!shareId) return new Response('Not found', { status: 404 });

  const supabaseUrl     = process.env['VITE_SUPABASE_URL'];
  const supabaseAnonKey = process.env['VITE_SUPABASE_ANON_KEY'];

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response('Server misconfigured', { status: 500 });
  }

  const dbRes = await fetch(
    `${supabaseUrl}/rest/v1/ranking_results?share_id=eq.${encodeURIComponent(shareId)}&is_public=eq.true&select=list_title,results`,
    { headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` } }
  );

  const data = await dbRes.json() as Array<{ list_title: string; results: RankItem[] }>;
  const row  = data[0];
  if (!row) return new Response('Not found', { status: 404 });

  const { list_title, results } = row;
  const top5 = results.slice(0, 5);

  const itemRows = top5.map((item, idx) =>
    div(
      {
        display: 'flex', alignItems: 'center', gap: '20px',
        padding: idx === 0 ? '14px 18px' : '9px 18px',
        background: MEDAL_BGS[idx] ?? 'transparent',
        borderRadius: '10px',
        borderLeft: `3px solid ${MEDAL_BORDERS[idx] ?? 'transparent'}`,
      },
      // Rank number
      div({
        fontSize: idx === 0 ? '32px' : '20px', fontWeight: 900,
        color: MEDAL_COLORS[idx] ?? 'rgba(255,255,255,0.38)',
        width: '52px', textAlign: 'right', letterSpacing: '-1px',
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
      }, String(idx + 1).padStart(2, '0')),
      // Vertical rule
      div({ width: '1px', height: '28px', background: 'rgba(255,255,255,0.08)', display: 'flex' }),
      // Text
      div({ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
        div({
          fontSize: idx === 0 ? '22px' : '18px',
          fontWeight: idx === 0 ? 700 : 600,
          color: idx === 0 ? '#ffffff' : 'rgba(255,255,255,0.82)',
          display: 'flex',
        }, item.title),
        item.subtitle
          ? div({ fontSize: '13px', color: 'rgba(255,255,255,0.36)', marginTop: '2px', display: 'flex' }, item.subtitle)
          : null
      ),
      // Medal label
      MEDAL_LABELS[idx]
        ? div({
            fontSize: '10px', fontWeight: 700,
            color: MEDAL_COLORS[idx] ?? 'rgba(255,255,255,0.38)',
            letterSpacing: '2px', display: 'flex', alignItems: 'center',
          }, MEDAL_LABELS[idx] ?? '')
        : null
    )
  );

  const moreRow = results.length > 5
    ? div(
        { display: 'flex', alignItems: 'center', padding: '8px 18px', color: 'rgba(255,255,255,0.28)', fontSize: '14px', fontStyle: 'italic', gap: '20px' },
        div({ width: '52px', display: 'flex' }),
        div({ width: '1px', height: '20px', background: 'rgba(255,255,255,0.06)', display: 'flex' }),
        div({ display: 'flex' }, `+ ${results.length - 5} more item${results.length - 5 !== 1 ? 's' : ''}`)
      )
    : null;

  const root = div(
    {
      width: '1200px', height: '630px', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(145deg, #0a0815 0%, #07070f 55%, #0e0b1c 100%)',
      color: '#ffffff', padding: '56px 68px',
      fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative',
    },
    // Purple glow
    div({ position: 'absolute', top: '-60px', left: '-40px', width: '480px', height: '480px', background: 'radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 70%)', display: 'flex' }),
    // Gold glow
    div({ position: 'absolute', bottom: '-40px', right: '-20px', width: '360px', height: '360px', background: 'radial-gradient(circle, rgba(212,160,23,0.1) 0%, transparent 70%)', display: 'flex' }),
    // Header
    div({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', position: 'relative' },
      div({ display: 'flex', flexDirection: 'column', maxWidth: '900px' },
        div({ fontSize: '11px', fontWeight: 700, letterSpacing: '4px', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', marginBottom: '10px', display: 'flex' }, 'MY RANKING'),
        div({ fontSize: '42px', fontWeight: 800, color: '#ffffff', lineHeight: 1.1, display: 'flex' }, list_title)
      ),
      div({ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.15)', letterSpacing: '4px', display: 'flex' }, 'RANKER')
    ),
    // Divider
    div({ height: '1px', background: 'rgba(255,255,255,0.1)', marginBottom: '18px', display: 'flex' }),
    // Items
    div({ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }, ...itemRows, moreRow),
    // Footer
    div({ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '14px', position: 'relative' },
      div({ height: '1px', flex: 1, background: 'rgba(255,255,255,0.06)', display: 'flex' }),
      div({ fontSize: '12px', color: 'rgba(255,255,255,0.18)', letterSpacing: '1px', display: 'flex' }, 'ranker.app')
    )
  );

  return new ImageResponse(root, { width: 1200, height: 630 });
}
