// The HOLD wordmark, inline.
//
// It is a component and not an <img> for one reason: it has to be white in the
// nav and the footer today, and it will have to be something else the first
// time it sits on a light surface. `fill="currentColor"` makes that a text-colour
// class instead of a second asset. The old mark was an amber PNG flipped to white
// with `filter: brightness(0) invert(1)`, which only ever worked because the
// source happened to be a solid colour on transparency.
//
// Geometry: 339 x 82 design grid, measured off Marketing/LOGOS V.3/1.png.
// The same path ships as /logo-hold.svg for anything outside React.

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 339 82"
      className={className}
      role="img"
      aria-label="HOLD"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M0,1 H18 V33.5 H55 V1 H73 V81 H55 V48.5 H18 V81 H0 Z
           M88,41 a43.5,41 0 1,0 87,0 a43.5,41 0 1,0 -87,0 Z
           M106,41 a25.5,26 0 1,0 51,0 a25.5,26 0 1,0 -51,0 Z
           M189,1 H207 V66 H248 V81 H189 Z
           M259,1 H299 A39.5,40 0 0,1 299,81 H259 Z
           M277,16 H300.5 A21,25 0 0,1 300.5,66 H277 Z"
      />
    </svg>
  );
}
