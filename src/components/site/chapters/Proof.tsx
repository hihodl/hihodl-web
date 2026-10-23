import type { ReactNode } from "react";

/**
 * The proof inside each sheet: small pieces of the app as it draws them, so
 * the photo carries the feeling and the sheet shows the thing actually exists.
 *
 * Every figure here is an example (an illustrative balance, a made up dinner),
 * never a rate, a price or a count. Rates live in rates.config.ts and are not
 * quoted on this page at all, and nothing here is presented as a customer.
 */

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mt-8 rounded-[20px] border border-white/10 bg-white/[0.05] p-5 ${className}`}>
      {children}
    </div>
  );
}

function Row({ left, right, sub }: { left: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 border-b border-white/[0.06] last:border-0">
      <div className="min-w-0">
        <p className="truncate text-small text-text">{left}</p>
        {sub && <p className="mt-0.5 truncate text-tiny text-text-faint">{sub}</p>}
      </div>
      {right && <div className="shrink-0 text-small font-mono text-text">{right}</div>}
    </div>
  );
}

export function AccountProof() {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-small text-text-muted">Main</p>
        <div className="flex gap-1.5">
          <span className="rounded-pill bg-white/10 px-2.5 py-1 text-tiny text-text">USD</span>
          <span className="rounded-pill border border-white/10 px-2.5 py-1 text-tiny text-text-muted">EUR</span>
        </div>
      </div>
      <p className="mt-3 font-display font-light text-[40px] leading-none tracking-[-0.03em] text-text">
        $2,340<span className="text-text-muted">.10</span>
      </p>
      <div className="mt-6">
        <Row left="Client payment" sub="USD account · Friday" right="+$1,800.00" />
        <Row left="@marta" sub="Sent · Thursday" right="−$45.00" />
      </div>
    </Card>
  );
}

export function SavingsProof() {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-small text-text-muted">Savings</p>
        <span className="inline-flex items-center gap-1.5 text-tiny text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Earning
        </span>
      </div>
      <p className="mt-3 font-display font-light text-[40px] leading-none tracking-[-0.03em] text-text">
        $1,500<span className="text-text-muted">.00</span>
      </p>
      <div className="mt-6">
        <Row left="Moved from Main" sub="Friday, 09:02" right="+$500.00" />
      </div>
    </Card>
  );
}

export function HiChatProof() {
  return (
    <Card className="space-y-3">
      <div className="ml-auto max-w-[85%] rounded-[18px] rounded-br-[6px] bg-white/[0.12] px-4 py-2.5 text-small text-text">
        A quiet room in Tokyo, 3 nights, under $150 a night
      </div>
      <div className="max-w-[85%] rounded-[18px] rounded-bl-[6px] bg-white/[0.05] px-4 py-2.5 text-small text-text">
        Found one in Shimokitazawa, a few minutes from the station.
      </div>
      <div className="rounded-[16px] border border-white/10 bg-[#0D1520] p-4">
        <p className="text-tiny uppercase tracking-wider text-text-faint">Stay · 3 nights</p>
        <p className="mt-1.5 text-body text-text">Shimokitazawa, Tokyo</p>
        <div className="mt-4 flex items-center justify-between">
          <p className="font-mono text-small text-text">$402.00</p>
          <span className="rounded-pill bg-amber px-4 py-2 text-tiny font-medium text-text-on-amber">
            Pay from balance
          </span>
        </div>
      </div>
      <p className="pt-1 text-tiny text-text-faint">Nothing is paid until you confirm.</p>
    </Card>
  );
}

const DINERS = ["You", "Marta", "Leo", "Inés"];

export function SplitProof() {
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <p className="text-small text-text">Dinner · Friday</p>
        <p className="font-mono text-small text-text-muted">$186.00</p>
      </div>
      <p className="mt-1 text-tiny text-text-faint">Split 4 ways · $46.50 each</p>
      <div className="mt-5 grid grid-cols-4 gap-2">
        {DINERS.map((name, i) => (
          <div key={name} className="flex flex-col items-center gap-2">
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-full text-small ${
                i < 3 ? "bg-white/[0.12] text-text" : "border border-dashed border-white/25 text-text-muted"
              }`}
            >
              {name[0]}
            </span>
            <span className="text-tiny text-text-muted">{i < 3 ? "Paid" : "Asked"}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function GroupProof() {
  return (
    <Card>
      <p className="text-tiny uppercase tracking-wider text-text-faint">Group · 4 people</p>
      <p className="mt-1.5 text-body text-text">Menorca, June</p>
      <div className="mt-5">
        <Row left="Stay booked" sub="Everyone paid their share" right="$1,240.00" />
        <Row left="Car and groceries" sub="Logged by Ana" right="$212.40" />
        <Row left="You" sub="All square" right="$0.00" />
      </div>
    </Card>
  );
}
