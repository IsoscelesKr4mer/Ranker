-- ============================================================
-- Ranker App — Supabase Schema
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

-- Anyone can view profiles (for community features)
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Users can insert their own profile
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 2. LISTS
-- ============================================================
create table public.lists (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references auth.users on delete cascade not null,
  title text not null,
  description text,
  category text not null default 'custom',
  source text not null default 'custom', -- 'preset', 'letterboxd', 'tmdb', 'custom'
  is_public boolean default false not null,
  is_community boolean default false not null, -- submitted to community hub
  item_count integer default 0 not null,
  cover_image_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.lists enable row level security;

create index idx_lists_creator_id on public.lists(creator_id);
create index idx_lists_community on public.lists(is_community) where is_community = true;

-- Users can see their own lists + all public/community lists
create policy "Users can view own lists"
  on public.lists for select
  using (auth.uid() = creator_id or is_public = true or is_community = true);

-- Users can create their own lists
create policy "Users can create lists"
  on public.lists for insert
  with check (auth.uid() = creator_id);

-- Users can update their own lists
create policy "Users can update own lists"
  on public.lists for update
  using (auth.uid() = creator_id);

-- Users can delete their own lists
create policy "Users can delete own lists"
  on public.lists for delete
  using (auth.uid() = creator_id);


-- 3. LIST ITEMS
-- ============================================================
create table public.list_items (
  id uuid default gen_random_uuid() primary key,
  list_id uuid references public.lists on delete cascade not null,
  title text not null,
  image_url text,
  subtitle text,
  metadata jsonb default '{}'::jsonb,
  position integer not null default 0,
  created_at timestamptz default now() not null
);

alter table public.list_items enable row level security;

create index idx_list_items_list_id on public.list_items(list_id);

-- List items inherit visibility from their parent list
create policy "List items visible if list is visible"
  on public.list_items for select
  using (
    exists (
      select 1 from public.lists
      where lists.id = list_items.list_id
      and (lists.creator_id = auth.uid() or lists.is_public = true or lists.is_community = true)
    )
  );

-- Users can add items to their own lists
create policy "Users can add items to own lists"
  on public.list_items for insert
  with check (
    exists (
      select 1 from public.lists
      where lists.id = list_items.list_id and lists.creator_id = auth.uid()
    )
  );

-- Users can update items in their own lists
create policy "Users can update items in own lists"
  on public.list_items for update
  using (
    exists (
      select 1 from public.lists
      where lists.id = list_items.list_id and lists.creator_id = auth.uid()
    )
  );

-- Users can delete items from their own lists
create policy "Users can delete items from own lists"
  on public.list_items for delete
  using (
    exists (
      select 1 from public.lists
      where lists.id = list_items.list_id and lists.creator_id = auth.uid()
    )
  );


-- 4. RANKING SESSIONS
-- ============================================================
create table public.ranking_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  list_id uuid references public.lists on delete set null,
  list_title text not null,
  status text not null default 'in_progress', -- 'in_progress', 'completed'
  comparisons_made integer default 0 not null,
  estimated_total integer default 0 not null,
  sort_state jsonb, -- serialized MergeSortState for pause/resume
  items jsonb not null, -- snapshot of items at ranking start
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  completed_at timestamptz
);

alter table public.ranking_sessions enable row level security;

create index idx_ranking_sessions_user_id on public.ranking_sessions(user_id);
create index idx_ranking_sessions_status on public.ranking_sessions(status) where status = 'in_progress';

-- Users can only see their own ranking sessions
create policy "Users can view own sessions"
  on public.ranking_sessions for select
  using (auth.uid() = user_id);

create policy "Users can create sessions"
  on public.ranking_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.ranking_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.ranking_sessions for delete
  using (auth.uid() = user_id);


-- 5. RANKING RESULTS
-- ============================================================
create table public.ranking_results (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.ranking_sessions on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  list_title text not null,
  results jsonb not null, -- ordered array of RankItems
  comparisons_made integer not null,
  is_public boolean default false not null, -- for shareable links
  share_id text unique, -- short id for share URLs
  created_at timestamptz default now() not null
);

alter table public.ranking_results enable row level security;

create index idx_ranking_results_user_id on public.ranking_results(user_id);
create index idx_ranking_results_share_id on public.ranking_results(share_id) where share_id is not null;

-- Users can see their own results + publicly shared results
create policy "Users can view own results"
  on public.ranking_results for select
  using (auth.uid() = user_id or is_public = true);

create policy "Users can create results"
  on public.ranking_results for insert
  with check (auth.uid() = user_id);

create policy "Users can update own results"
  on public.ranking_results for update
  using (auth.uid() = user_id);

create policy "Users can delete own results"
  on public.ranking_results for delete
  using (auth.uid() = user_id);


-- 6. COMMUNITY VOTES (upvotes on community lists)
-- ============================================================
create table public.community_votes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  list_id uuid references public.lists on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(user_id, list_id) -- one vote per user per list
);

alter table public.community_votes enable row level security;

create index idx_community_votes_list_id on public.community_votes(list_id);

create policy "Votes are viewable by everyone"
  on public.community_votes for select using (true);

create policy "Users can add votes"
  on public.community_votes for insert
  with check (auth.uid() = user_id);

create policy "Users can remove own votes"
  on public.community_votes for delete
  using (auth.uid() = user_id);


-- 7. UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

create trigger update_lists_updated_at
  before update on public.lists
  for each row execute function public.update_updated_at_column();

create trigger update_ranking_sessions_updated_at
  before update on public.ranking_sessions
  for each row execute function public.update_updated_at_column();


-- 8. STORAGE BUCKET (for custom list image uploads)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('list-images', 'list-images', true)
on conflict (id) do nothing;

create policy "Anyone can view list images"
  on storage.objects for select
  using (bucket_id = 'list-images');

create policy "Authenticated users can upload list images"
  on storage.objects for insert
  with check (bucket_id = 'list-images' and auth.role() = 'authenticated');

create policy "Users can delete own list images"
  on storage.objects for delete
  using (bucket_id = 'list-images' and auth.uid()::text = (storage.foldername(name))[1]);
