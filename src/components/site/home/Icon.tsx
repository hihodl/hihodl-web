/** Line icons drawn at 24, 1.7 stroke, in currentColor. One set for the whole page. */
const PATHS = {
  bank: "M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18M12 3l9 5H3l9-5Z",
  at: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm0 0v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1",
  split: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3Zm4 5h6m-6 4h6",
  leaf: "M7 21h10M12 21v-9m0 0C12 7 9 4 4 4c0 5 3 8 8 8Zm0 0c0-4 2.5-6.5 8-6.5 0 4.5-3 6.5-8 6.5Z",
  chart: "M3 3v18h18M7 15l4-4 3 3 5-6",
  bed: "M3 18V7m0 7h18v4M3 14V11h7a3 3 0 0 1 3 3M21 14v-2a3 3 0 0 0-3-3h-5",
  signal: "M5 20v-3m5 3v-7m5 7v-11m5 11V4",
  spark: "M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z",
  key: "M15 7a4 4 0 1 1-3.9 4.9L3 20v-3h3v-3h3l2.1-2.1A4 4 0 0 1 15 7Zm1 0h.01",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 4l16 16",
  face: "M4 8V5a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3m0 8v3a1 1 0 0 1-1 1h-3m-8 0H5a1 1 0 0 1-1-1v-3m5-6v1m6-1v1m-3 0v3h-1m-2 3c1.5 1 4.5 1 6 0",
  lifebuoy: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5.6 5.6l3.6 3.6m5.6 5.6 3.6 3.6m0-12.8-3.6 3.6m-5.6 5.6-3.6 3.6",
  phoneOff: "M10.7 13.3a10 10 0 0 0 4.2 2.5l1.8-1.8a1 1 0 0 1 1-.3c1.1.4 2.3.6 3.3.6a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1A17 17 0 0 1 4 3a1 1 0 0 1 1-1h3.7a1 1 0 0 1 1 1c0 1 .2 2.2.6 3.3a1 1 0 0 1-.3 1L8.2 9.1M22 2 2 22",
  card: "M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7Zm0 3h20M6 15h4",
  check: "M5 12.5l4.5 4.5L19 7.5",
  plus: "M12 5v14M5 12h14",
  chevron: "M6 9l6 6 6-6",
  arrow: "M9 6l6 6-6 6",
  close: "M6 6l12 12M18 6 6 18",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  plane: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z",
  download: "M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  network: "M12 3v6m0 6v6M3 12h6m6 0h6M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z",
  addCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v8m-4-4h8",
  send: "M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z",
  swap: "M7 7h13l-4-4M17 17H4l4 4",
  wallet: "M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1h1a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 1h15m-2 6h.01",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
