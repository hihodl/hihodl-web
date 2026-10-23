import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appLinks";

/** The two store badges, drawn as the homepage draws them: white pills, the store's own names. */
export function StoreBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>
      <Badge href={APP_STORE_URL} eyebrow="Download on the" label="App Store" icon={<AppleIcon />} />
      <Badge href={PLAY_STORE_URL} eyebrow="Get it on" label="Google Play" icon={<GoogleIcon />} />
    </div>
  );
}

function Badge({ href, eyebrow, label, icon }: { href: string; eyebrow: string; label: string; icon: JSX.Element }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-3 rounded-pill bg-white px-6 py-3.5 text-[#0A0500] transition-transform duration-180 ease-out-soft hover:scale-[1.02]"
    >
      {icon}
      <span className="flex flex-col items-start leading-none">
        <span className="text-tiny opacity-70">{eyebrow}</span>
        <span className="mt-0.5 text-body font-medium">{label}</span>
      </span>
    </a>
  );
}

function AppleIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.523 12.025c-.041-3.07 2.508-4.546 2.625-4.616-1.43-2.092-3.652-2.378-4.435-2.398-1.886-.193-3.687 1.114-4.643 1.114-.974 0-2.439-1.094-4.014-1.063-2.062.03-3.967 1.197-5.022 3.034-2.144 3.71-.547 9.183 1.527 12.197 1.014 1.476 2.21 3.121 3.785 3.064 1.535-.062 2.108-.974 3.957-.974 1.836 0 2.371.974 3.967.94 1.642-.03 2.674-1.485 3.654-2.97.95-1.476 1.34-2.913 1.36-2.989-.03-.014-2.61-1-2.638-3.953m-2.97-7.247c.819-1.018 1.376-2.413 1.226-3.821-1.183.052-2.66.804-3.515 1.806-.755.892-1.42 2.343-1.246 3.7 1.328.103 2.687-.674 3.535-1.685" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3.609 1.814 13.792 12 3.61 22.186a.998.998 0 0 1-.609-.92V2.734a1 1 0 0 1 .608-.92zm10.89 10.893 2.302 2.302-10.937 6.333 8.635-8.635zm3.794-4.31 2.85 1.65a1 1 0 0 1 0 1.736l-3.05 1.766L15.207 12l3.086-3.086zm-3.794-.69L5.864 1.36l10.937 6.334-2.302 2.302z" />
    </svg>
  );
}
