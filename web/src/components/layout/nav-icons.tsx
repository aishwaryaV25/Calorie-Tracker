import type { ReactNode } from 'react';

/** Stroke icons used in the signed-in sidebar. */
export function NavIcon({
  name,
  className = 'size-4',
}: {
  name: 'today' | 'log' | 'goals' | 'weight' | 'entries' | 'reports' | 'chat' | 'import' | 'bite';
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
    case 'weight':
      return (
        <svg {...props}>
          <path d="M7 8h10l1.5 12H5.5z" />
          <path d="M9 8V6.5A3 3 0 0 1 15 6.5V8" />
          <path d="M12 12v4" />
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
    case 'bite':
      return (
        <svg {...props}>
          <path d="M5 11.5c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5-3.1 6.5-7 6.5c-.7 0-1.4-.1-2-.3L6 19l.8-2.6C5.7 15.4 5 13.6 5 11.5Z" />
          <circle cx="9.2" cy="11.2" r="0.9" fill="currentColor" />
          <circle cx="12" cy="11.2" r="0.9" fill="currentColor" />
          <circle cx="14.8" cy="11.2" r="0.9" fill="currentColor" />
        </svg>
      );
  }
}
