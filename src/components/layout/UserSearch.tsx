import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { searchProfiles } from '@/lib/database';
import type { PublicProfile } from '@/types';

export function UserSearch({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const navigate = useNavigate();

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setFocusedIndex(-1);
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open, close]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const data = await searchProfiles(query);
      setResults(data);
      setLoading(false);
      setFocusedIndex(-1);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function goToProfile(userId: string) {
    navigate(`/profile/${userId}`);
    close();
    onNavigate?.();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && focusedIndex >= 0 && results[focusedIndex]) {
      e.preventDefault();
      goToProfile(results[focusedIndex].id);
    } else if (e.key === 'Escape') {
      close();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
        title="Search users"
      >
        <Search size={16} />
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.07] border border-white/[0.12] focus-within:border-violet-500/50 transition-colors">
        <Search size={14} className="text-white/30 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search users…"
          className="bg-transparent text-sm text-white/90 placeholder:text-white/30 outline-none w-36"
        />
        <button onClick={close} className="text-white/30 hover:text-white/60 transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* Dropdown */}
      {query.trim() && (
        <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl bg-[#12121f] border border-white/[0.08] shadow-xl shadow-black/40 overflow-hidden z-50">
          {loading ? (
            <div className="px-4 py-3 text-xs text-white/40">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-xs text-white/40">No users found</div>
          ) : (
            <ul>
              {results.map((profile, i) => (
                <li key={profile.id}>
                  <button
                    onClick={() => goToProfile(profile.id)}
                    onMouseEnter={() => setFocusedIndex(i)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                      focusedIndex === i ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-violet-400 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-white leading-none">
                          {(profile.username || profile.displayName || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-sm text-white/80 truncate">
                      {profile.username || profile.displayName || 'Anonymous'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
