/**
 * HOLD for AI agents: the facts the /agents page prints.
 *
 * Copied from the backend, never written from memory. When the backend changes
 * one of these, this file is wrong until it is updated:
 *
 *   server/services/agents/config.ts        scopes, public base, TTLs, rate limit
 *   server/services/agents/mcp-tools.ts     TOOL_INPUTS, TOOL_SCOPES, TOOL_INFO
 *   server/services/agents/oauth.service.ts the two metadata documents
 *   server/services/agents/pay/policy.ts    AGENT_PAY_LIMITS
 *   server/services/agents/pay/denylist.ts  the cash-out block
 *   server/services/x402/x402.service.ts    HANDLE_MIN_BASE / HANDLE_MAX_BASE
 *   server/api/x402.router.ts               the x402 routes
 */

export const API_BASE = "https://api.hihodl.xyz";
export const MCP_URL = `${API_BASE}/mcp`;

export type Scope = "read" | "search" | "request_money" | "propose_payments" | "pay";

export const SCOPES: { id: Scope; name: string; plain: string; moves: string }[] = [
  {
    id: "read",
    name: "See your money",
    plain: "Your balances, your recent activity and your @handle, name and display currency.",
    moves: "Moves nothing.",
  },
  {
    id: "search",
    name: "Search",
    plain: "Hotels for your dates, flights, and paid APIs it could use for you.",
    moves: "Moves nothing.",
  },
  {
    id: "request_money",
    name: "Ask for money",
    plain: "Makes a single use payment link in dollars, paid into your account, for whoever owes you.",
    moves: "Money only comes in.",
  },
  {
    id: "propose_payments",
    name: "Propose payments",
    plain:
      "Lines up a payment to a HOLD @handle, a hotel, a flight or an Amazon or eBay product. It lands in your HOLD app and you approve it with Face ID, or decline it.",
    moves: "Nothing moves until you approve. A proposal expires after 24 hours.",
  },
  {
    id: "pay",
    name: "Pay within limits",
    plain:
      "Pays for APIs on the sites you allowed, and sends dollars to the people you allowed, without asking each time.",
    moves: "Only inside the limits you set. Anything over them becomes a proposal or is refused.",
  },
];

export type ToolInput = { name: string; type: string; required: boolean; note: string };
export type Tool = { name: string; scope: Scope; title: string; readOnly: boolean; description: string; inputs: ToolInput[] };

const MONEY = 'decimal string, cents at most ("12.50")';
const DAY = "YYYY-MM-DD";

export const TOOLS: Tool[] = [
  {
    name: "get_balances",
    scope: "read",
    title: "Balances",
    readOnly: true,
    description: "Your HOLD accounts and what each holds, plus the total in your display currency. Amounts are decimal strings.",
    inputs: [],
  },
  {
    name: "get_recent_activity",
    scope: "read",
    title: "Recent activity",
    readOnly: true,
    description: "Recent money movements, newest first: date, what, who, signed amount (negative is money out), currency.",
    inputs: [
      { name: "limit", type: "integer 1 to 20", required: false, note: "How many movements (default 10)" },
      { name: "days", type: "integer 1 to 90", required: false, note: "How far back, in days (default 30)" },
    ],
  },
  {
    name: "get_profile",
    scope: "read",
    title: "Profile",
    readOnly: true,
    description: "Your HOLD @handle, name and display currency.",
    inputs: [],
  },
  {
    name: "search_stays",
    scope: "search",
    title: "Search hotels",
    readOnly: true,
    description: "The 5 best bookable hotels for the dates, with the total for the stay and the price range a night.",
    inputs: [
      { name: "city", type: "string", required: false, note: "City, e.g. Lisbon (city or query is needed)" },
      { name: "query", type: "string", required: false, note: "An area or a landmark, if not a city" },
      { name: "checkIn", type: DAY, required: true, note: "Check-in date" },
      { name: "checkOut", type: DAY, required: true, note: "After checkIn" },
      { name: "adults", type: "integer 1 to 8", required: false, note: "Default 2" },
      { name: "currency", type: '"USD" | "EUR"', required: false, note: "Default USD" },
    ],
  },
  {
    name: "search_flights",
    scope: "search",
    title: "Search flights",
    readOnly: true,
    description: "The 5 cheapest flights, one way or return, with airline, times, stops, bags and the price with HOLD's fee in it. Offers expire about 30 minutes after the search.",
    inputs: [
      { name: "from", type: "string", required: true, note: "IATA code (MAD) or city" },
      { name: "to", type: "string", required: true, note: "IATA code (BCN) or city" },
      { name: "date", type: DAY, required: true, note: "Departure" },
      { name: "return", type: DAY, required: false, note: "Return, for a round trip" },
      { name: "adults", type: "integer 1 to 4", required: false, note: "Default 1" },
    ],
  },
  {
    name: "find_paid_services",
    scope: "search",
    title: "Find paid APIs (x402)",
    readOnly: true,
    description: "Searches Coinbase's x402 Bazaar for paid APIs HOLD can pay (USDC on Base): host, name, price per call, URL, method and an example body when listed.",
    inputs: [
      { name: "query", type: "string, 120 max", required: true, note: 'What you need, e.g. "weather forecast"' },
      { name: "maxUsdPrice", type: 'USD decimal string ("0.05")', required: false, note: "Only services at most this per call" },
    ],
  },
  {
    name: "create_payment_link",
    scope: "request_money",
    title: "Create a payment link",
    readOnly: false,
    description: "A single use HOLD payment link for a fixed amount in USD, paid into the user's account. Never sends the user's money.",
    inputs: [
      { name: "amount", type: MONEY, required: true, note: 'e.g. "25.00"' },
      { name: "currency", type: '"USD"', required: true, note: "Payment links are priced in dollars" },
      { name: "note", type: "string, 140 max", required: false, note: "What it is for; the payer sees it" },
    ],
  },
  {
    name: "propose_send",
    scope: "propose_payments",
    title: "Propose a payment",
    readOnly: false,
    description:
      "Proposes paying a HOLD user by @handle; the user approves or declines in the app with Face ID. With the pay permission, a dollar amount to a handle the user allowed, inside the limits, is sent at once with no approval.",
    inputs: [
      { name: "toHandle", type: "string", required: true, note: "The HOLD @handle to pay" },
      { name: "amount", type: MONEY, required: true, note: 'e.g. "20.00"' },
      { name: "currency", type: '"USD" | "EUR" | "USDC" | "EURC"', required: true, note: "USDC and EURC are the same money as USD and EUR" },
      { name: "note", type: "string, 140 max", required: false, note: "Short note for the payment" },
    ],
  },
  {
    name: "propose_booking",
    scope: "propose_payments",
    title: "Propose a booking",
    readOnly: false,
    description: "Proposes a stay (from search_stays), a flight (from search_flights) or an Amazon or eBay product. Nothing is paid: the user reviews and pays in the app.",
    inputs: [
      { name: "kind", type: '"stay" | "flight" | "product"', required: true, note: "What to book" },
      { name: "hotelId", type: "string", required: false, note: "stay: from search_stays" },
      { name: "checkIn", type: DAY, required: false, note: "stay" },
      { name: "checkOut", type: DAY, required: false, note: "stay" },
      { name: "adults", type: "integer 1 to 8", required: false, note: "stay: default 2" },
      { name: "roomId", type: "string", required: false, note: "stay: a specific room, if known" },
      { name: "currency", type: '"USD" | "EUR"', required: false, note: "stay: the currency search_stays priced in" },
      { name: "offerId", type: "string", required: false, note: "flight: from search_flights" },
      { name: "url", type: "string", required: false, note: "product: an Amazon or eBay product link" },
    ],
  },
  {
    name: "get_action",
    scope: "propose_payments",
    title: "Check a proposal",
    readOnly: true,
    description: "The status of something proposed: pending, completed, declined or expired (24 hours).",
    inputs: [{ name: "id", type: "uuid", required: true, note: "The id propose_send or propose_booking returned" }],
  },
  {
    name: "pay_x402",
    scope: "pay",
    title: "Pay for an API (x402)",
    readOnly: false,
    description:
      "Fetches an https URL and, if it answers 402 Payment Required, pays it in USDC on Base from the user's HOLD balance: only allowed hostnames, within the per payment limit, the daily budget and maxAmount. If the paid call fails, the money goes back.",
    inputs: [
      { name: "url", type: "https URL", required: true, note: "The paid resource; its hostname must be allowed" },
      { name: "method", type: '"GET" | "POST"', required: false, note: "Default GET" },
      { name: "body", type: "string, 16 KB max", required: false, note: "POST only: the JSON body as a string" },
      { name: "maxAmount", type: 'USD decimal string ("0.05")', required: true, note: "The most you will pay; if the site asks more, nothing is paid" },
      { name: "idempotencyKey", type: "string 8 to 128", required: false, note: "The same key within 60 seconds never pays twice" },
    ],
  },
  {
    name: "get_spending",
    scope: "pay",
    title: "Spending limits",
    readOnly: true,
    description: "dailyBudget, spentToday (last 24 hours), perPaymentLimit, allowedDomains, and remainingOnChain (what is left of the budget for every assistant).",
    inputs: [],
  },
];

/** AGENT_PAY_LIMITS, in whole dollars. */
export const LIMITS = {
  budgetMin: 10,
  budgetMax: 500,
  budgetDefault: 50,
  dailyMax: 100,
  dailyDefault: 5,
  perPaymentDefault: 1,
  maxDomains: 20,
  maxHandles: 20,
  pushFrom: 1,
} as const;

/** AGENTS in config.ts. */
export const OAUTH = {
  connectWindowMinutes: 10,
  accessTokenMinutes: 60,
  refreshTokenDays: 30,
  proposalHours: 24,
  maxPendingProposals: 20,
  callsPerMinute: 60,
} as const;

export const ENDPOINTS: { method: string; path: string; what: string }[] = [
  { method: "GET", path: "/.well-known/oauth-protected-resource", what: "Protected resource metadata (RFC 9728), also at /.well-known/oauth-protected-resource/mcp" },
  { method: "GET", path: "/.well-known/oauth-authorization-server", what: "Authorization server metadata (RFC 8414)" },
  { method: "POST", path: "/oauth/register", what: "Dynamic client registration (RFC 7591), public clients, no secret" },
  { method: "GET", path: "/oauth/authorize", what: "The connect page: a 6 character code and a QR the user approves in the app" },
  { method: "POST", path: "/oauth/token", what: "authorization_code and refresh_token grants" },
  { method: "POST", path: "/oauth/revoke", what: "Token revocation (RFC 7009)" },
  { method: "POST", path: "/mcp", what: "MCP over Streamable HTTP, Authorization: Bearer" },
];

/** The x402 routes, mounted at the API root (and under /api/v1). */
export const X402_ROUTES: { method: string; path: string; what: string }[] = [
  { method: "GET | POST", path: "/x402/pay/@handle?amount=1.50", what: "Pay a HOLD user any amount from $0.01 to $1,000. Optional note (140 max) and ref (64 max)." },
  { method: "GET | POST", path: "/x402/link/:id", what: "Pay a HOLD payment link by its id or code (USD links on Base)." },
  { method: "GET", path: "/.well-known/x402", what: "The links their owners chose to list for agents." },
];
