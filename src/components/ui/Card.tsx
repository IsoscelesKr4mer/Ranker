import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddings = {
  none: '',
  sm: 'p-5',
  md: 'p-7',
  lg: 'p-10',
};

export function Card({ children, hover = false, padding = 'md', className = '', ...props }: CardProps) {
  return (
    <div
      className={`
        bg-white/[0.045] border border-white/[0.10] rounded-2xl
        backdrop-blur-sm
        ${hover
          ? 'transition-all duration-200 hover:bg-white/[0.075] hover:border-white/[0.18] hover:shadow-xl hover:shadow-black/25 cursor-pointer'
          : ''
        }
        ${paddings[padding]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
