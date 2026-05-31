// Simple inline icons. Kept to basic strokes/paths.
const I = {};

I.Check = (p) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

I.Shield = (p) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M12 2.5l7.5 3v5.5c0 4.7-3.2 8.1-7.5 9.5-4.3-1.4-7.5-4.8-7.5-9.5V5.5L12 2.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M8.8 12.2l2.2 2.2 4.2-4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

I.Lock = (p) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="15.3" r="1.4" fill="currentColor" />
  </svg>
);

I.Send = (p) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M4 12l16-7-7 16-2.5-6.5L4 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
  </svg>
);

I.Replay = (p) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M4 12a8 8 0 1 1 2.5 5.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    <path d="M4 18.5V13h5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

I.Doc = (p) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M6 3h8l4 4v14H6V3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M14 3v4h4M9 13h6M9 16.5h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

I.Layers = (p) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M3 13l9 5 9-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

I.Pill = (p) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <rect x="3" y="8.5" width="18" height="7" rx="3.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 8.5v7" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

I.Sparkle = (p) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

I.Database = (p) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="1.7" />
    <path d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

I.ChevLeft = (p) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

I.ChevRight = (p) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

I.ChevDown = (p) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M5 9l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

window.I = I;
