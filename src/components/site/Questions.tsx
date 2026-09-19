import type { ReactNode } from "react";

/**
 * A short list of questions, closed by default, in small type.
 *
 * This is where "how we make money" lives on every page: one question among
 * the others, for the reader who wants to open it. It is disclosed on the
 * product's own page, and it is never a headline.
 */
export function QuestionList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <ul className={`border-t border-[color:var(--color-hairline)] ${className}`}>{children}</ul>;
}

export function QuestionItem({ q, children }: { q: string; children: ReactNode }) {
  return (
    <li className="border-b border-[color:var(--color-hairline)]">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-3.5 text-small text-text-muted transition-colors duration-180 hover:text-text group-open:text-text [&::-webkit-details-marker]:hidden">
          {q}
          <svg
            width="10"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            aria-hidden
            className="shrink-0 transition-transform duration-180 group-open:rotate-180"
          >
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className="max-w-2xl pb-5 text-small text-text-muted">{children}</div>
      </details>
    </li>
  );
}
