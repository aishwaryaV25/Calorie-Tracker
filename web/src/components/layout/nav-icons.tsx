import type { ReactNode } from 'react';

/** Stroke icons used in the signed-in sidebar. */
export function NavIcon({
  name,
  className = 'size-4',
}: {
  name: 'today' | 'log' | 'goals' | 'entries' | 'reports' | 'chat' | 'import';
  className?: string;
}): ReactNode {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };

  switch (name) {
    case 'today':
      return (
        <svg {...props}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
        </svg>
      );
    case 'log':
      return (
        <svg {...props}>
          <path d="M4 7h16M4 12h10M4 17h7" />
          <path d="M17 14v6M14 17h6" />
        </svg>
      );
    case 'goals':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </svg>
      );
    case 'entries':
      return (
        <svg {...props}>
          <rect x="5" y="4" width="14" height="16" rx="2" />
          <path d="M8 9h8M8 13h8M8 17h5" />
        </svg>
      );
    case 'reports':
      return (
        <svg {...props}>
          <path d="M4 19V5M4 19h16" />
          <path d="M8 15v-4M12 15V8M16 15v-6" />
        </svg>
      );
    case 'chat':
      return (
        <svg {...props}>
          <path d="M5 16.5 4 20l3.8-1.4A8 8 0 1 0 5 16.5Z" />
        </svg>
      );
    case 'import':
      return (
        <svg {...props}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
          <path d="M14 3v6h6M12 12v5M9.5 15.5 12 18l2.5-2.5" />
        </svg>
      );
  }
}
