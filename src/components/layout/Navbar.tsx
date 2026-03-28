import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui';

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, status, signOut } = useAuthStore();

  const links = [
    { to: '/browse', label: 'Browse' },
    { to: '/community', label: 'Community' },
    ...(user ? [{ to: '/dashboard', label: 'Dashboard' }] : []),
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <nav className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#060610]/85 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-8 sm:px-12">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-violet-600/30">
              R
            </div>
            <span
              className="text-base font-bold tracking-tight text-white/90"
              style={{ fontFamily: 'var(--font-family-display)' }}
            >
              Ranker
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-0.5">
            {links.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive(link.to)
                    ? 'text-white/95 bg-white/[0.08]'
                    : 'text-white/45 hover:text-white/75 hover:bg-white/[0.04]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth area */}
          <div className="hidden md:flex items-center gap-2.5">
            {status === 'authenticated' && user ? (
              <div className="flex items-center gap-2.5">
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                  ) : (
                    <User size={14} className="text-white/40" />
                  )}
                  <span className="text-xs text-white/60 font-medium">Account</span>
                </Link>
                <button
                  onClick={signOut}
                  className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : status !== 'loading' ? (
              <Link to="/auth">
                <Button variant="secondary" size="sm">Sign In</Button>
              </Link>
            ) : null}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
          >
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-[#060610]/98 backdrop-blur-xl">
          <div className="px-4 py-3 space-y-0.5">
            {links.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive(link.to)
                    ? 'text-white bg-white/[0.07]'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-white/[0.05]">
              {user ? (
                <div className="space-y-1">
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm text-white/60 hover:text-white/80"
                  >
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                    ) : (
                      <User size={15} className="text-white/40" />
                    )}
                    Account
                  </Link>
                  <button
                    onClick={() => { signOut(); setMobileOpen(false); }}
                    className="flex items-center gap-2 px-4 py-3 text-sm text-white/45 hover:text-white/75"
                  >
                    <LogOut size={15} /> Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm text-violet-400 font-semibold"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
