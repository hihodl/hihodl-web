/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/ui/**/*.{tsx,ts,js,jsx}",
  ],
  presets: [require("./src/ui/tailwind.config.js")],
  theme: {
    extend: {
      colors: {
        // HIHODL — primary
        amber: {
          DEFAULT: "#FFB703",
          glow:    "#FFD234",
          deep:    "#B87D00",
        },
        // HIHODL — brand blue (sampled from logo)
        "brand-blue": {
          DEFAULT: "#4F7090",
          deep:    "#2C4566",
          glow:    "#7295B5",
        },
        // HIHODL — counterpoint
        moonlight: {
          DEFAULT: "#5B7CFF",
          faint:   "#2A3866",
        },
        // Surfaces — fintech-twilight, lifted per brand feedback
        abyss:    "#141F2E",
        night:    "#1B2638",
        "warm-noir": "#221A14",
        // Text
        text: {
          DEFAULT: "#F4F6FA",
          muted:   "#9BA3B0",
          faint:   "#5A6068",
          "on-amber": "#0A0500",
        },
        // Functional
        success: "#4ADE80",
        danger:  "#FF5F5F",
      },
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        sans:    ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        serif:   ['"Source Serif 4"', 'Georgia', 'serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Display sizes — paired with light weight + negative tracking
        'display':    ['96px', { lineHeight: '1', letterSpacing: '-0.04em' }],
        'display-sm': ['64px', { lineHeight: '1.05', letterSpacing: '-0.035em' }],
        'h1':         ['72px', { lineHeight: '1.05', letterSpacing: '-0.035em' }],
        'h2':         ['48px', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'h3':         ['32px', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
        'h4':         ['24px', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'lead':       ['21px', { lineHeight: '1.5', letterSpacing: '0' }],
        'body':       ['16px', { lineHeight: '1.5', letterSpacing: '0' }],
        'small':      ['14px', { lineHeight: '1.5', letterSpacing: '0' }],
        'tiny':       ['12px', { lineHeight: '1.4', letterSpacing: '0.02em' }],
      },
      fontWeight: {
        // Strict weights — never go above 600
        light:   '200',
        book:    '300',
        regular: '400',
        medium:  '500',
        strong:  '600',
      },
      borderRadius: {
        card:  '18px',
        input: '14px',
        pill:  '9999px',
        tight: '8px',
      },
      spacing: {
        '15': '60px',
        '18': '72px',
        '22': '88px',
        '30': '120px',
        '40': '160px',
      },
      backdropBlur: {
        glass: '24px',
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":  "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "moonlight-glow":  "radial-gradient(ellipse at top, rgba(91,124,255,0.15), transparent 60%)",
        "amber-glow":      "radial-gradient(ellipse at bottom, rgba(255,183,3,0.12), transparent 60%)",
      },
      transitionTimingFunction: {
        'out-soft':   'cubic-bezier(0.22, 1, 0.36, 1)',
        'in-out-soft':'cubic-bezier(0.65, 0, 0.35, 1)',
      },
      transitionDuration: {
        '180': '180ms',
        '320': '320ms',
        '560': '560ms',
        '900': '900ms',
      },
    },
  },
  plugins: [],
};
