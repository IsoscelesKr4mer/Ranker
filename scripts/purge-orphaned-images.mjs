/**
 * One-time cleanup script: removes files from the list-images Supabase Storage
 * bucket that are no longer referenced by any list or list_item row.
 *
 * Usage (from the /ranker directory):
 *   node scripts/purge-orphaned-images.mjs
 *
 * Requirements:
 *   - VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set in .env  (already there)
 *   - You must be logged in as the user whose images you want to clean up.
 *     Supply your user ID via the USER_ID env var:
 *
 *   USER_ID=your-user-uuid node scripts/purge-orphaned-images.mjs
 *
 *   To find your user ID: Supabase dashboard → Authentication → Users → copy
 *   the UUID next to your email address.
 *
 * NOTE: The anon key only allows users to manage their OWN files (RLS).
 *       If you need to clean up files for ALL users, swap in a service_role
 *       key (keep it secret — never commit it) and remove the USER_ID filter.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── Load .env manually (no dotenv dependency needed) ──────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
const env = {};
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) env[key.trim()] = rest.join('=').trim();
  }
} catch {
  console.error('Could not read .env — make sure you run this from the ranker/ directory.');
  process.exit(1);
}

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY; // bypasses RLS — required for deletions
const USER_ID = process.env.USER_ID;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing from .env');
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error(
    '\nMissing SERVICE_ROLE_KEY — the anon key cannot delete files from Node.js (no auth session).\n\n' +
    'Get your service role key from:\n' +
    '  Supabase Dashboard → Project Settings → API → service_role (secret key)\n\n' +
    'Then run:\n' +
    '  $env:USER_ID="your-uuid"; $env:SERVICE_ROLE_KEY="your-service-role-key"; node scripts/purge-orphaned-images.mjs\n'
  );
  process.exit(1);
}
if (!USER_ID) {
  console.error(
    'Please supply your Supabase user UUID:\n' +
    '  $env:USER_ID="your-uuid"; $env:SERVICE_ROLE_KEY="..."; node scripts/purge-orphaned-images.mjs',
  );
  process.exit(1);
}

// Use service role key for admin-level storage access (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ─── Helper ────────────────────────────────────────────────────────
function extractStoragePath(url) {
  if (!url) return null;
  const marker = '/list-images/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

// ─── Main ──────────────────────────────────────────────────────────
async function purge() {
  console.log(`\nScanning storage bucket for user: ${USER_ID}\n`);

  // 1. List every file in the user's storage folder (paginated)
  const PAGE_SIZE = 1000;
  let allFiles = [];
  let offset = 0;
  while (true) {
    const { data: page, error: listError } = await supabase.storage
      .from('list-images')
      .list(USER_ID, { limit: PAGE_SIZE, offset });
    if (listError) {
      console.error('Failed to list storage files:', listError.message);
      process.exit(1);
    }
    if (!page || page.length === 0) break;
    allFiles = allFiles.concat(page);
    if (page.length < PAGE_SIZE) break; // last page
    offset += PAGE_SIZE;
  }
  const storageFiles = allFiles;

  if (storageFiles.length === 0) {
    console.log('No files found in storage — nothing to clean up.');
    return;
  }
  console.log(`Found ${storageFiles.length} file(s) in storage.`);

  // 2. Collect all image URLs currently referenced in the DB
  const [listsRes, itemsRes] = await Promise.all([
    supabase.from('lists').select('cover_image_url').eq('creator_id', USER_ID),
    supabase
      .from('list_items')
      .select('image_url, lists!inner(creator_id)')
      .eq('lists.creator_id', USER_ID),
  ]);

  if (listsRes.error) { console.error('Error fetching lists:', listsRes.error.message); process.exit(1); }
  if (itemsRes.error) { console.error('Error fetching list items:', itemsRes.error.message); process.exit(1); }

  const referencedPaths = new Set();
  for (const row of listsRes.data || []) {
    const p = extractStoragePath(row.cover_image_url);
    if (p) referencedPaths.add(p);
  }
  for (const row of itemsRes.data || []) {
    const p = extractStoragePath(row.image_url);
    if (p) referencedPaths.add(p);
  }
  console.log(`${referencedPaths.size} image(s) are still referenced in the DB.`);

  // 3. Any file NOT in the referenced set is orphaned
  const orphans = storageFiles
    .map(f => `${USER_ID}/${f.name}`)
    .filter(path => !referencedPaths.has(path));

  if (orphans.length === 0) {
    console.log('\nNo orphaned images found — storage is already clean!');
    return;
  }

  console.log(`\nOrphaned files to delete (${orphans.length}):`);
  for (const o of orphans) console.log('  •', o);

  const { error: removeError } = await supabase.storage.from('list-images').remove(orphans);
  if (removeError) {
    console.error('\nDelete failed:', removeError.message);
    process.exit(1);
  }

  console.log(`\n✓ Deleted ${orphans.length} orphaned image(s).`);
}

purge();
