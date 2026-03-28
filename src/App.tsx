import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

// Lazy-loaded pages — each becomes its own chunk
const Landing = lazy(() => import('@/pages/Landing'));
const Auth = lazy(() => import('@/pages/Auth'));
const Browse = lazy(() => import('@/pages/Browse'));
const CreateList = lazy(() => import('@/pages/CreateList'));
const Ranking = lazy(() => import('@/pages/Ranking'));
const Results = lazy(() => import('@/pages/Results'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Community = lazy(() => import('@/pages/Community'));
const SharedResult = lazy(() => import('@/pages/SharedResult'));
const SavedResult = lazy(() => import('@/pages/SavedResult'));

// Minimal loading screen that matches our dark theme
function PageLoader() {
  return (
    <div className="min-h-screen min-h-dvh bg-bg-primary flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-violet-400 animate-pulse" />
        <span className="text-sm text-white/30">Loading...</span>
      </div>
    </div>
  );
}

function AppRoutes() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/create" element={<CreateList />} />
        <Route path="/ranking/preset/:presetId" element={<Ranking />} />
        <Route path="/ranking/letterboxd" element={<Ranking />} />
        <Route path="/ranking/custom" element={<Ranking />} />
        <Route path="/results" element={<Results />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/community" element={<Community />} />
        <Route path="/results/:resultId" element={<SavedResult />} />
        <Route path="/shared/:shareId" element={<SharedResult />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
