import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={`relative inline-flex items-center justify-center p-2 rounded-xl border transition-all duration-300 cursor-pointer backdrop-blur-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-95 ${
        isDark
          ? 'bg-slate-800/60 hover:bg-slate-700/60 border-slate-700/60 text-amber-400'
          : 'bg-white/30 hover:bg-white/50 border-white/40 text-slate-800 shadow-xs'
      } ${className}`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center overflow-hidden">
        {/* Sun Icon (shown in Dark mode to switch to Light mode) */}
        <Sun
          className={`w-4 h-4 transition-all duration-300 motion-reduce:transition-none absolute ${
            isDark
              ? 'rotate-0 scale-100 opacity-100'
              : 'rotate-90 scale-0 opacity-0'
          }`}
          aria-hidden="true"
        />
        {/* Moon Icon (shown in Light mode to switch to Dark mode) */}
        <Moon
          className={`w-4 h-4 transition-all duration-300 motion-reduce:transition-none absolute ${
            isDark
              ? '-rotate-90 scale-0 opacity-0'
              : 'rotate-0 scale-100 opacity-100'
          }`}
          aria-hidden="true"
        />
      </div>
    </button>
  );
};

export default ThemeToggle;
