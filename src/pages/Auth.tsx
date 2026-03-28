import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Card, Input } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { Mail, ArrowLeft } from 'lucide-react';

export default function Auth() {
  const navigate = useNavigate();
  const { user, status, signInWithGoogle, signInWithMagicLink } = useAuthStore();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated' && user) {
      // If there are pending results from before auth, go back to results page
      const pendingResults = sessionStorage.getItem('pendingResults');
      if (pendingResults) {
        navigate('/results');
      } else {
        navigate('/dashboard');
      }
    }
  }, [status, user, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (err) {
      setError('Failed to sign in with Google. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      const result = await signInWithMagicLink(email);

      if (result.error) {
        setError(result.error);
      } else {
        setSubmitted(true);
        setEmail('');
      }
    } catch (err) {
      setError('Failed to send sign-in link. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08080f] flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Background Gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute top-10 right-20 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-8 sm:px-12 pt-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back home</span>
        </Link>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-8 sm:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {!submitted ? (
            <Card padding="lg" className="space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-violet-600 to-violet-400 rounded-xl shadow-lg shadow-violet-500/30 mb-4">
                  <span className="text-lg font-bold text-white">R</span>
                </div>
                <h1 className="text-2xl font-bold text-white">
                  Welcome to Ranker
                </h1>
                <p className="text-white/50">
                  Sign in to start ranking and discover your preferences
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-lg p-3"
                >
                  <p className="text-sm text-red-400">{error}</p>
                </motion.div>
              )}

              {/* Google Sign In */}
              <Button
                onClick={handleGoogleSignIn}
                disabled={loading}
                fullWidth
                size="lg"
                className="bg-white/[0.06] text-white hover:bg-white/[0.12] border border-white/[0.12]"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.06]" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-[#08080f] text-white/40">
                    or continue with email
                  </span>
                </div>
              </div>

              {/* Magic Link Form */}
              <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  disabled={loading}
                  label="Email"
                />

                <Button
                  type="submit"
                  disabled={loading || !email}
                  fullWidth
                  size="lg"
                  className="bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 shadow-lg shadow-violet-500/20"
                >
                  {loading ? 'Sending...' : 'Send sign-in link'}
                </Button>
              </form>

              {/* Footer */}
              <p className="text-center text-xs text-white/40">
                We'll send you a secure link to sign in.
                <br />
                No password needed.
              </p>
            </Card>
          ) : (
            /* Success State */
            <Card padding="lg" className="space-y-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-full shadow-lg shadow-emerald-500/30 mx-auto"
              >
                <Mail className="w-8 h-8 text-white" />
              </motion.div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">
                  Check your email
                </h2>
                <p className="text-white/60 text-sm">
                  We've sent a sign-in link to <span className="font-medium text-white/80">{email}</span>
                </p>
              </div>

              <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-4 space-y-2">
                <p className="text-sm text-white/70">
                  The link will expire in <span className="font-medium text-white">24 hours</span>.
                </p>
                <p className="text-xs text-white/50">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
              </div>

              <Button
                variant="secondary"
                fullWidth
                size="md"
                onClick={() => {
                  setSubmitted(false);
                  setEmail('');
                  setError('');
                }}
              >
                Try another email
              </Button>

              <Link to="/">
                <Button
                  variant="ghost"
                  fullWidth
                  size="md"
                >
                  Back to home
                </Button>
              </Link>
            </Card>
          )}
        </motion.div>
      </div>

      {/* Footer */}
      <div className="relative z-10 border-t border-white/[0.06] px-8 sm:px-12 py-8 text-center">
        <p className="text-sm text-white/40">
          By signing in, you agree to our{' '}
          <a href="#" className="text-white/60 hover:text-white/80 transition-colors underline">
            Terms of Service
          </a>
          {' '}and{' '}
          <a href="#" className="text-white/60 hover:text-white/80 transition-colors underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
