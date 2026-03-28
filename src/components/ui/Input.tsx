import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-white/65 mb-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full px-4 py-3 rounded-xl text-sm
            bg-white/[0.05] border border-white/[0.10]
            text-white/90 placeholder:text-white/30
            focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/15
            hover:border-white/[0.18]
            transition-all duration-150
            ${error ? 'border-red-500/50 focus:border-red-500/60 focus:ring-red-500/15' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
