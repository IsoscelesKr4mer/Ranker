import type { ReactNode } from 'react';
import { Navbar } from './Navbar';

interface PageLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const widths = {
  sm: 'max-w-xl',
  md: 'max-w-3xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl',
  full: 'max-w-full',
};

export function PageLayout({ children, hideNav = false, maxWidth = 'lg' }: PageLayoutProps) {
  return (
    <div className="min-h-screen min-h-dvh bg-bg-primary">
      {!hideNav && <Navbar />}
      <main className={`${widths[maxWidth]} mx-auto px-8 sm:px-12 py-10 sm:py-14 overflow-x-clip`}>
        {children}
      </main>
    </div>
  );
}
