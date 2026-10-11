import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { SectionHairline } from "@/components/site/SectionHairline";
import { DocAnswer, DocCard, DocLimit, DocStep } from "@/components/site/Doc";
import {
  API_BASE,
  ENDPOINTS,
  LIMITS,
  MCP_URL,
  OAUTH,
  SCOPES,
  TOOLS,
  X402_ROUTES,
  type Scope,
} from "@/lib/agents/reference";

/**
 * /agents: HOLD for AI agents. How to connect Claude, Claude Code, ChatGPT or Cursor, what
 * each permission lets an assistant do, the limits, and the developer reference.
 *
 * Every fact on this page comes from src/lib/agents/reference.ts, which names
 * the backend file each one is copied from. Write nothing here that is not in
 * that file.
 *
 * Beta, invite only: the backend serves the feature only to the user ids on its
 * allowlist (AGENTS_ALLOWED_USERS), and paying by x402 only to the people on
 * X402_SELL_ALLOWED_USERS. The page says so in the hero and in the FAQ.
 */

const TITLE = "HOLD for AI agents";
const DESCRIPTION =
  "Connect Claude, ChatGPT or Cursor to your HOLD account. Your assistant reads your balances, finds hotels and flights, asks for money and pays for APIs over x402, inside the limits you set.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/agents" },
  openGraph: {
    type: "website",
    url: "/agents",
    siteName: "HOLD",
    title: `${TITLE}: your AI assistants, paid from HOLD`,
    description: DESCRIPTION,
    images: [{ url: "/banner-social.png", width: 1200, height: 630, alt: "HOLD for AI agents", type: "image/png" }],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@hiihodl",
    creator: "@hiihodl",
    title: `${TITLE}: your AI assistants, paid from HOLD`,
    description: DESCRIPTION,
    images: ["/banner-social.png"],
  },
};

const CURSOR_CONFIG = `{
  "mcpServers": {
    "hold": { "url": "${MCP_URL}" }
  }
}`;

const CLAUDE_CODE_ADD = `claude mcp add --transport http hold ${MCP_URL}`;

const CURL_QUOTE = `curl -i "${API_BASE}/x402/pay/@yourhandle?amount=1.50&note=Thanks"`;

const CURL_PAY = `curl -i "${API_BASE}/x402/pay/@yourhandle?amount=1.50&note=Thanks" \\
  -H "PAYMENT-SIGNATURE: <base64 x402 v2 payment payload>"`;

const FAQ = [
  {
    q: "Who can use it?",
    a: "It is in beta and invite only. Until your account is invited, the HOLD app will not approve a connection. Ask us at hello@hihodl.xyz.",
  },
  {
    q: "Which assistants work?",
    a: "Any assistant that speaks MCP with OAuth: Claude, Claude Code, ChatGPT and Cursor among them. They all use the same address and the same approval in the HOLD app.",
  },
  {
    q: "Can it spend my money without asking?",
    a: "Only if you turn on the pay permission for it in the HOLD app, under Settings > AI assistants, and then only inside the limits you set: the money you set aside, a daily budget, a per payment limit, and the sites and people you allowed. Everything else waits for you to approve it in the app.",
  },
  {
    q: "What if it goes over its limit?",
    a: "Nothing is paid. The payment comes to your HOLD app instead, with the amount and who it is for. Approve it and HOLD pays it once, decline it, or let it expire after 24 hours. Always allow puts that site or person on the list for next time. The money you set aside is a hard ceiling an approval cannot lift.",
  },
  {
    q: "How do I disconnect an assistant?",
    a: "From the HOLD app, at any time. Its access ends at once, together with every token it holds.",
  },
  {
    q: "Does the assistant see my keys or my password?",
    a: "No. It gets a token for the permissions you approved and nothing else. Approving happens on your phone, with Face ID.",
  },
  {
    q: "What does it cost?",
    a: "Connecting is free. What an assistant pays for, an API or a booking, is what you pay, the same as in the app.",
  },
];

const SCOPE_LABEL: Record<Scope, string> = Object.fromEntries(SCOPES.map((s) => [s.id, s.name])) as Record<Scope, string>;

export default function AgentsPage() {
  return (
    <>
      <TopNav />

      <main>
        {/* ─── Hero ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <div className="absolute inset-0 bg-moonlight-glow opacity-30 pointer-events-none" aria-hidden />
          <div className="container-page section relative">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-tiny uppercase tracking-wider text-moonlight">HOLD for AI agents</p>
                <span className="inline-flex items-center gap-2 rounded-pill border border-[color:var(--color-hairline-strong)] bg-white/[0.06] px-3 py-1 text-tiny uppercase tracking-wider text-text">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber" aria-hidden />
                  Beta, invite only
                </span>
              </div>
              <h1 className="mt-6 font-display text-h1 font-light text-text leading-tight">
                Your AI assistants,
                <br />
                <span className="text-text-muted">paid from HOLD.</span>
              </h1>
              <p className="mt-8 text-lead text-text-muted">
                Connect Claude, ChatGPT or Cursor to your account. Your assistant checks your
                balance, finds the hotel, lines up the payment and pays for the APIs it needs,
                inside the limits you set.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <a
                  href="#connect"
                  className="inline-flex items-center justify-center px-7 py-4 rounded-pill bg-amber text-text-on-amber font-medium text-body hover:bg-amber-glow transition-all duration-180 ease-out-soft hover:scale-[1.02]"
                >
                  Connect HOLD to Claude
                </a>
                <a
                  href="#developers"
                  className="inline-flex items-center justify-center px-6 py-4 rounded-pill border border-[color:var(--color-hairline-strong)] bg-white/[0.06] text-text text-body hover:bg-white/[0.1] transition-colors duration-180"
                >
                  For developers
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Connect ───────────────────────────────────────────── */}
        <section id="connect" className="relative overflow-hidden bg-abyss scroll-mt-20">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">Connect in three steps</h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                One address for every assistant:
              </p>
              <CopyLine value={MCP_URL} />
            </div>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
              <ClientCard name="Claude">
                <DocStep n={1} title="Add a connector" body="In Claude, open Settings, then Connectors, and choose Add custom connector." />
                <DocStep n={2} title="Paste the address" body={`Name it HOLD and paste ${MCP_URL}. Then press Connect.`} />
                <DocStep n={3} title="Approve on your phone" body="A HOLD page opens with a code. Approve it in the HOLD app and you are back in Claude." />
              </ClientCard>
              <ClientCard name="Claude Code">
                <DocStep n={1} title="Add the server" body="In a terminal, run:" />
                <div className="pl-12">
                  <Code>{CLAUDE_CODE_ADD}</Code>
                </div>
                <DocStep n={2} title="Sign in" body="In Claude Code, type /mcp, pick hold and sign in. A HOLD page opens with a code." />
                <DocStep
                  n={3}
                  title="Approve on your phone"
                  body="HOLD shows it as Unverified app, because it signs in through your own computer. That is expected. Approve it in the HOLD app."
                />
              </ClientCard>
              <ClientCard name="ChatGPT">
                <DocStep n={1} title="Add a connector" body="In ChatGPT settings, create a custom connector for a remote MCP server." />
                <DocStep n={2} title="Paste the address" body={`Use ${MCP_URL} and choose OAuth to sign in.`} />
                <DocStep n={3} title="Approve on your phone" body="The HOLD page shows a code. Approve it in the HOLD app." />
              </ClientCard>
              <ClientCard name="Cursor">
                <DocStep n={1} title="Open your MCP settings" body="Add a server to Cursor's mcp.json, globally or for one project." />
                <div className="pl-12">
                  <Code>{CURSOR_CONFIG}</Code>
                </div>
                <DocStep n={2} title="Log in" body="Cursor asks you to log in to HOLD. A HOLD page opens with a code." />
                <DocStep n={3} title="Approve on your phone" body="Approve it in the HOLD app and the tools show up in Cursor." />
              </ClientCard>
            </div>

            <div className="mt-16 max-w-3xl">
              <h3 className="font-display text-h3 font-light text-text">What happens when you connect</h3>
              <div className="mt-8 flex flex-col gap-8">
                <DocStep
                  n={1}
                  title="A code on screen"
                  body="Your assistant opens a HOLD page with a 6 character code and a QR. Nobody signs in to HOLD on the web: the page only waits for your phone."
                />
                <DocStep
                  n={2}
                  title="The same code in the app"
                  body={`Scan the QR, or tap the button on a phone, and HOLD opens with the same code and the name of the assistant asking. The request waits ${OAUTH.connectWindowMinutes} minutes.`}
                />
                <DocStep
                  n={3}
                  title="You choose the permissions"
                  body="Keep the ones you want, drop the rest, and approve with Face ID. The page sends you back to your assistant, connected. Paying by itself is not on this list: you turn it on later in the app."
                />
              </div>
            </div>
          </div>
        </section>

        {/* ─── Permissions ───────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="blue" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">What an assistant can do</h2>
              <p className="mt-6 text-lead text-text">
                It never moves your money without your limits or your approval.
              </p>
              <p className="mt-4 text-body text-text-muted leading-relaxed">
                Six permissions. You pick five of them when you connect. The sixth, Pay within
                limits, is never asked for at connect. You turn it on later for each assistant in
                the HOLD app, under Settings &gt; AI assistants, and it works at once. Turn it off
                there and payments stop at once.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
              {SCOPES.map((s) => (
                <div key={s.id} className="rounded-card p-8 border border-[color:var(--color-hairline)] bg-white/[0.03]">
                  <p className="font-mono text-tiny text-moonlight">{s.id}</p>
                  <h3 className="mt-3 font-display text-h4 font-light text-text leading-snug">{s.name}</h3>
                  <p className="mt-4 text-body text-text-muted leading-relaxed">{s.plain}</p>
                  <p className="mt-4 text-small text-text">{s.moves}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Limits ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="amber" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">Limits you set</h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                For an assistant with the pay permission. Two layers: one amount set aside for
                all of them, and each assistant&rsquo;s own controls on top.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
              <DocCard
                title="Money set aside"
                body={`You set aside between $${LIMITS.budgetMin} and $${LIMITS.budgetMax} ($${LIMITS.budgetDefault} unless you change it) once, for every assistant together, in USDC on Base. That is the most they can ever spend, whatever else happens.`}
              />
              <DocCard
                title="Per day"
                body={`Each assistant has its own daily budget, $${LIMITS.dailyDefault} to start and up to $${LIMITS.dailyMax}. It counts the last 24 hours, so there is no midnight to wait for.`}
              />
              <DocCard
                title="Per payment"
                body={`The most one payment can be, $${LIMITS.perPaymentDefault} to start and never above the daily budget. The assistant also names its own maximum on every call; if a site asks for more, nothing is paid.`}
              />
              <DocCard
                title="Sites"
                body={`An assistant pays by itself only on the sites you list, up to ${LIMITS.maxDomains}, by exact name: allowing api.example.com does not allow example.com. Any other site, it asks you first.`}
              />
              <DocCard
                title="People"
                body={`Up to ${LIMITS.maxHandles} @handles it may send to without asking, inside the limits. Any other person, it asks you first.`}
              />
              <DocCard
                title="Every payment, in view"
                body={`Every payment is in your Activity, and from $${LIMITS.pushFrom} you get a notification. If a paid call fails, the money comes back to you.`}
              />
              <DocCard
                title="Euros too"
                body="Set aside euros as well, in EURC on Base, with their own daily budget and per payment limit, and your assistant can send euros to the people you allowed. Paid sites always charge in dollars."
              />
              <DocCard
                title="Over a limit, it asks"
                body="A payment over a limit, or to a site or person not on the list, is not refused and not paid: it lands in your HOLD app. Approve it and HOLD pays it once; tap Always allow and that site or person goes on the list."
              />
            </div>

            <div className="mt-12 max-w-3xl">
              <DocLimit title="Cards and payouts are blocked.">
                <p>
                  Gift cards, prepaid and virtual cards, push to card, Venmo, PayPal and bank
                  payouts are refused, even on a site you allowed, and even if you approve them.
                  An assistant&rsquo;s budget pays for services; it never turns into cash
                  somewhere else.
                </p>
                <p>
                  An approval never lifts the money you set aside or your balance either. And
                  HOLD can pause payments by assistants at any time; while paused, nothing is
                  charged.
                </p>
              </DocLimit>
            </div>
          </div>
        </section>

        {/* ─── Developers ───────────────────────────────────────── */}
        <section id="developers" className="relative overflow-hidden bg-night scroll-mt-20">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <p className="text-tiny uppercase tracking-wider text-moonlight">For developers</p>
              <h2 className="mt-4 font-display text-h2 font-light text-text">The reference</h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                An MCP server over Streamable HTTP at <InlineCode>{MCP_URL}</InlineCode>, with
                OAuth 2.1. A token sees only the tools its permissions reach. Amounts are decimal
                strings, never floats.
              </p>
              <p className="mt-4 text-body text-text-muted leading-relaxed">
                Rate limits: each assistant gets {OAUTH.callsPerMinute} tool calls and{" "}
                {OAUTH.messagesPerMinute} messages a minute. Connecting has its own limits,
                such as {OAUTH.registrationsPerHour} client registrations an hour. Over a limit
                you get <InlineCode>429</InlineCode> with <InlineCode>Retry-After</InlineCode>.
              </p>
            </div>

            {/* Tools */}
            <div className="mt-14">
              <h3 className="font-display text-h3 font-light text-text">Tools</h3>
              <div className="mt-8 flex flex-col gap-4">
                {TOOLS.map((t) => (
                  <details
                    key={t.name}
                    className="group rounded-card border border-[color:var(--color-hairline)] bg-white/[0.03] p-6 open:bg-white/[0.05] transition-colors"
                  >
                    <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-mono text-body text-text break-words">{t.name}</p>
                        <p className="mt-2 text-small text-text-muted">
                          {t.title} <span className="text-text-faint">·</span>{" "}
                          <span className="font-mono text-tiny text-moonlight">{t.scope}</span>
                          {t.readOnly ? <span className="text-text-faint"> · read only</span> : null}
                        </p>
                      </div>
                      <span className="mt-1 shrink-0 text-text-faint group-open:rotate-45 transition-transform duration-180" aria-hidden>
                        +
                      </span>
                    </summary>
                    <p className="mt-4 text-body text-text-muted leading-relaxed">{t.description}</p>
                    {t.inputs.length ? (
                      <ul className="mt-5 flex flex-col divide-y divide-[color:var(--color-hairline)] border-t border-[color:var(--color-hairline)]">
                        {t.inputs.map((i) => (
                          <li key={i.name} className="py-3 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6">
                            <p className="sm:w-48 shrink-0 font-mono text-small text-text">
                              {i.name}
                              {i.required ? null : <span className="text-text-faint">?</span>}
                            </p>
                            <div className="min-w-0">
                              <p className="font-mono text-tiny text-moonlight break-words">{i.type}</p>
                              <p className="mt-1 text-small text-text-muted">{i.note}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 text-small text-text-faint">No inputs.</p>
                    )}
                  </details>
                ))}
              </div>
              <p className="mt-6 text-small text-text-faint">
                A name with <span className="font-mono">?</span> is optional. Permission per tool:{" "}
                {SCOPES.map((s, i) => (
                  <span key={s.id}>
                    <span className="font-mono">{s.id}</span> ({SCOPE_LABEL[s.id]}){i < SCOPES.length - 1 ? ", " : "."}
                  </span>
                ))}
              </p>
            </div>

            {/* x402 */}
            <div className="mt-20 grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="min-w-0">
                <h3 className="font-display text-h3 font-light text-text">Paying APIs with x402</h3>
                <div className="mt-6 space-y-4 text-body text-text-muted leading-relaxed">
                  <p>
                    With the pay permission, <InlineCode>pay_x402</InlineCode> fetches a URL and,
                    when it answers <InlineCode>402 Payment Required</InlineCode>, pays it: scheme
                    exact, USDC on Base, x402 v1 or v2.
                  </p>
                  <p>
                    It pays only an allowed hostname, over https, within the per payment limit,
                    the daily budget and the <InlineCode>maxAmount</InlineCode> of the call. The
                    same <InlineCode>idempotencyKey</InlineCode> within 60 seconds returns the
                    first payment instead of a second one.
                  </p>
                  <p>
                    <InlineCode>find_paid_services</InlineCode> searches Coinbase&rsquo;s x402
                    Bazaar for APIs HOLD can pay, and <InlineCode>get_spending</InlineCode> tells
                    the assistant what it has left before it tries.
                  </p>
                  <p>
                    Over a limit, or on a site not on the list, nothing is paid and the tool
                    returns <InlineCode>{'status: "waiting_for_approval"'}</InlineCode> with an{" "}
                    <InlineCode>actionId</InlineCode>. Once the user approves, HOLD makes the call
                    and pays it once; <InlineCode>get_action</InlineCode> then returns{" "}
                    <InlineCode>completed</InlineCode> with the paid response, or{" "}
                    <InlineCode>failed</InlineCode>, <InlineCode>declined</InlineCode> or{" "}
                    <InlineCode>expired</InlineCode>. While payments are paused, the pay tools
                    return <InlineCode>paused</InlineCode> and nothing is charged; do not retry
                    straight away.
                  </p>
                </div>
              </div>

              <div className="min-w-0">
                <h3 className="font-display text-h3 font-light text-text">Getting paid with x402</h3>
                <div className="mt-6 space-y-4 text-body text-text-muted leading-relaxed">
                  <p>
                    Any agent can pay a HOLD user in USDC on Base, straight to their own address.
                    By @handle, the user&rsquo;s personal link must be on Base and active. Amounts
                    go from $0.01 to $1,000. Ask without a payment header and you get the 402:
                  </p>
                </div>
                <Code>{CURL_QUOTE}</Code>
                <div className="mt-4 space-y-4 text-body text-text-muted leading-relaxed">
                  <p>
                    Sign the EIP-3009 authorization it describes and send the same request again
                    with <InlineCode>PAYMENT-SIGNATURE</InlineCode> (v2) or{" "}
                    <InlineCode>X-PAYMENT</InlineCode> (v1):
                  </p>
                </div>
                <Code>{CURL_PAY}</Code>
                <p className="mt-4 text-body text-text-muted leading-relaxed">
                  <InlineCode>200</InlineCode> with <InlineCode>{"{ paid, to, amount, txHash }"}</InlineCode>{" "}
                  once settled, <InlineCode>202</InlineCode> while it is still settling (send the
                  same header again to read the outcome). The money lands in the recipient&rsquo;s
                  Main Account as income.
                </p>
              </div>
            </div>

            <div className="mt-10">
              <RouteTable rows={X402_ROUTES} />
              <p className="mt-4 text-small text-text-faint">
                A link pays at its own amount, or at the <InlineCode>amount</InlineCode> you pass when
                the link leaves it open. Recurring links, group links and euro links cannot be paid
                by agents. A link its owner chose to list can be listed in Coinbase&rsquo;s x402
                Bazaar. In the beta, only invited HOLD users can be paid this way.
              </p>
            </div>

            {/* OAuth */}
            <div className="mt-20">
              <h3 className="font-display text-h3 font-light text-text">OAuth</h3>
              <p className="mt-6 max-w-2xl text-body text-text-muted leading-relaxed">
                HOLD is both the authorization server and the resource. Public clients only (no
                secret), PKCE with S256 required, dynamic client registration and client ID
                metadata documents both accepted, tokens bound to the resource{" "}
                <InlineCode>{MCP_URL}</InlineCode>. Access tokens last {OAUTH.accessTokenMinutes}{" "}
                minutes, refresh tokens {OAUTH.refreshTokenDays} days.
              </p>
              <div className="mt-8">
                <RouteTable rows={ENDPOINTS} />
              </div>
              <p className="mt-6 text-small text-text-faint">
                Every path is on <InlineCode>{API_BASE}</InlineCode>. Scopes:{" "}
                {SCOPES.map((s, i) => (
                  <span key={s.id}>
                    <InlineCode>{s.id}</InlineCode>
                    {i < SCOPES.length - 1 ? " " : "."}
                  </span>
                ))}{" "}
                A client never gets <InlineCode>pay</InlineCode> at connect; the user turns it on
                in the app, and it applies at once. Proposals expire after {OAUTH.proposalHours} hours, and at most{" "}
                {OAUTH.maxPendingProposals} wait at once.
              </p>
            </div>
          </div>
        </section>

        {/* ─── FAQ ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">Questions</h2>
            </div>
            <div className="mt-14 max-w-3xl flex flex-col gap-4">
              {FAQ.map((item) => (
                <DocAnswer key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
            <p className="mt-10 text-body text-text-muted">
              Want in?{" "}
              <a href="mailto:hello@hihodl.xyz" className="text-text hover:text-amber underline">
                hello@hihodl.xyz
              </a>
              . New to HOLD?{" "}
              <Link href="/" className="text-text hover:text-amber underline">
                Start here
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

/* ────────────────────────────────────────────────────────────── */

function ClientCard({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card p-6 sm:p-8 border border-[color:var(--color-hairline)] bg-white/[0.03] min-w-0">
      <h3 className="font-display text-h4 font-light text-text">{name}</h3>
      <div className="mt-6 flex flex-col gap-6">{children}</div>
    </div>
  );
}

function CopyLine({ value }: { value: string }) {
  return (
    <p className="mt-4 inline-block max-w-full rounded-pill border border-[color:var(--color-hairline-strong)] bg-white/[0.06] px-5 py-3 font-mono text-small text-text break-all select-all">
      {value}
    </p>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-4 max-w-full overflow-x-auto rounded-card border border-[color:var(--color-hairline)] bg-abyss/80 p-4 font-mono text-tiny leading-relaxed text-text">
      <code>{children}</code>
    </pre>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[0.9em] text-text break-words">{children}</code>;
}

function RouteTable({ rows }: { rows: { method: string; path: string; what: string }[] }) {
  return (
    <div className="flex flex-col gap-px bg-[color:var(--color-hairline)] border border-[color:var(--color-hairline)] rounded-card overflow-hidden">
      {rows.map((r) => (
        <div key={r.path} className="bg-night/60 px-5 sm:px-8 py-5 flex flex-col md:flex-row md:items-baseline gap-2 md:gap-8">
          <p className="md:w-[26rem] shrink-0 min-w-0 font-mono text-small text-text break-all">
            <span className="text-moonlight">{r.method}</span> {r.path}
          </p>
          <p className="text-small text-text-muted leading-relaxed">{r.what}</p>
        </div>
      ))}
    </div>
  );
}
