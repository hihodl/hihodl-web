/**
 * HOLD for AI agents: the facts the /agents page prints.
 *
 * Copied from the backend, never written from memory. When the backend changes
 * one of these, this file is wrong until it is updated:
 *
 *   server/services/agents/config.ts        scopes, public base, TTLs, rate limit
 *   server/api/agents-oauth.router.ts       the connect and register rate limits
 *   server/services/x402/config.ts          the beta list, Bazaar listing
 *   server/services/agents/mcp-tools.ts     TOOL_INPUTS, TOOL_SCOPES, TOOL_INFO
 *   server/services/agents/markets/tools.ts MARKET_TOOL_INPUTS, _SCOPES, _INFO
 *   server/services/agents/markets/rules.ts SWAP_TOKENS, SAVINGS_TOKENS, XSTOCK_*
 *   server/services/agents/pay/ask.ts       ask instead of refuse
 *   server/services/hold-handle.ts          the @handle rule
 *   server/services/agents/oauth.service.ts the two metadata documents
 *   server/services/agents/pay/policy.ts    AGENT_PAY_LIMITS, ASKABLE_REFUSALS, USD/EUR
 *   server/services/agents/pay/denylist.ts  the cash-out block
 *   server/services/x402/x402.service.ts    HANDLE_MIN_BASE / HANDLE_MAX_BASE
 *   server/api/x402.router.ts               the x402 routes
 */

export const API_BASE = "https://api.hihodl.xyz";

/**
 * What is switched on in production, read from the Render env (19 October
 * 2026): AGENTS_MCP_ENABLED on for the beta list, AGENTS_PAY_ENABLED off (the
 * pay scope is not in /.well-known/oauth-protected-resource), X402_SELL_ENABLED
 * off (/x402/pay answers 404). The page prints the pay permission, its limits
 * and the x402 routes only while these say so.
 */
export const LIVE = { pay: false, x402Sell: false } as const;
export const MCP_URL = `${API_BASE}/mcp`;

export type Scope = "read" | "search" | "markets" | "request_money" | "propose_payments" | "pay";

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
    plain: LIVE.pay ? "Hotels for your dates, flights, and paid APIs it could use for you." : "Hotels for your dates and flights, priced live.",
    moves: "Moves nothing.",
  },
  {
    id: "markets",
    name: "Markets",
    plain: "Live prices, your portfolio with what you paid, the day's biggest movers, Savings rates and a quote for a conversion.",
    moves: "Reads only. Conversions, investing and taking money out of Savings are proposals, under Propose payments.",
  },
  {
    id: "request_money",
    name: "Ask for money",
    plain:
      "Makes payment links paid into your account: one for whoever owes you, or one per person to split a bill in dollars or euros. Your friends pay from the link, nothing to install.",
    moves: "Money only comes in.",
  },
  {
    id: "propose_payments",
    name: "Propose payments",
    plain:
      "Lines up a payment to a HOLD @handle, a hotel, a flight, an Amazon or eBay product, a conversion, money into Savings or a stock, or money out of Savings. It lands in your HOLD app and you approve it with Face ID, or decline it.",
    moves: "Nothing moves until you approve. A proposal expires after 24 hours.",
  },
  {
    id: "pay",
    name: "Pay within limits",
    plain:
      "Pays for APIs on the sites you allowed, and sends dollars or euros to the people you allowed, without asking each time. No assistant gets it when it connects: you turn it on later, per assistant, in the HOLD app under Settings > AI assistants. Turn it off there and payments stop at once.",
    moves: "Only inside the limits you set. Over a limit, or to a site or person not on its list, it asks you first.",
  },
];

export type ToolInput = { name: string; type: string; required: boolean; note: string };
export type Tool = { name: string; scope: Scope; title: string; readOnly: boolean; description: string; inputs: ToolInput[] };

const MONEY = 'decimal string, cents at most ("12.50")';
const DAY = "YYYY-MM-DD";

/** markets/rules.ts */
const SWAP_TOKENS = ["SOL", "USDC", "USDT", "EURC"];
const SAVINGS_TOKENS = ["USDC", "USDT", "USDG", "USDS", "PYUSD"];
const XSTOCK_SYMBOLS = ["AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "GOOGL", "META", "SPY", "QQQ", "COIN", "MSTR", "AMD", "NFLX"];
const XSTOCK_BUY_MIN_USD = 1;
const XSTOCK_BUY_MAX_USD = 100;
const MOVERS = ["BTC", "ETH", "SOL", "POL", "LINK", "UNI", "AAVE", "LDO", "BONK"];

const SWAP_INPUTS: ToolInput[] = [
  { name: "from", type: SWAP_TOKENS.join(" | "), required: true, note: "What to sell" },
  { name: "to", type: SWAP_TOKENS.join(" | "), required: true, note: "What to buy" },
  { name: "amount", type: 'decimal string ("25", "0.5")', required: true, note: "How much of from" },
];

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
      { name: "query", type: "string, 120 max", required: true, note: 'What you need, e.g. "weather forecast" or "web search"' },
      { name: "maxUsdPrice", type: 'USD decimal string ("0.05")', required: false, note: "Only services at most this per call" },
    ],
  },
  {
    name: "get_prices",
    scope: "markets",
    title: "Prices",
    readOnly: true,
    description: "Live prices in USD for tickers (BTC, ETH, SOL, LINK...). Tickers HOLD cannot price are listed in unpriced.",
    inputs: [{ name: "symbols", type: "string[], 1 to 20", required: true, note: 'Tickers, e.g. ["BTC","ETH","SOL"]' }],
  },
  {
    name: "get_portfolio",
    scope: "markets",
    title: "Portfolio",
    readOnly: true,
    description:
      "What the user holds across their HOLD accounts, by token: amount, price, value in USD and, where HOLD knows it, the average cost and the profit or loss. Also the total in their display currency.",
    inputs: [],
  },
  {
    name: "get_market_movers",
    scope: "markets",
    title: "Market movers",
    readOnly: true,
    description: "The tokens HOLD lets people buy that moved most in the last 24 hours, gainers and losers, with price and change in percent.",
    inputs: [{ name: "limit", type: `integer 1 to ${MOVERS.length}`, required: false, note: "How many gainers and losers (default 3)" }],
  },
  {
    name: "get_savings_rates",
    scope: "markets",
    title: "Savings rates",
    readOnly: true,
    description:
      "The live yearly rates of HOLD Savings, per stablecoin: apy is what the user earns, after HOLD's share of the interest; grossApy is the venue's rate. Rates move; they are not promised.",
    inputs: [],
  },
  {
    name: "quote_swap",
    scope: "markets",
    title: "Quote a swap",
    readOnly: true,
    description: "A live estimate of converting one token into another in HOLD, on Solana through Jupiter: what the user would get, the least they would get, HOLD's fee and the price impact.",
    inputs: SWAP_INPUTS,
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
    name: "split_payment",
    scope: "request_money",
    title: "Split a bill",
    readOnly: false,
    description:
      "Splits a bill the user paid into equal parts and makes one single use payment link per person, paid into the user's account, plus a ready message with every link for the group chat. Leftover cents go to the first people. A euro bill is charged in dollars at today's rate and each link shows the part in euros. If some links could not be made (notMade), the others still work. Never sends the user's money.",
    inputs: [
      { name: "total", type: MONEY, required: true, note: 'The whole bill, e.g. "120.00"' },
      { name: "currency", type: '"USD" | "EUR"', required: true, note: "The bill's currency" },
      { name: "title", type: "string, 60 max", required: true, note: "What it was; every payer sees it" },
      { name: "people", type: "string[], 1 to 9", required: true, note: "First names or @handles, each once; the user is not in the list" },
      { name: "includeMe", type: "boolean", required: false, note: "The user pays an equal part too (default true)" },
    ],
  },
  {
    name: "propose_send",
    scope: "propose_payments",
    title: "Propose a payment",
    readOnly: false,
    description:
      "Proposes paying a HOLD user by @handle, in USD or EUR; the user approves or declines in the app with Face ID. With the pay permission, an amount to a handle the user allowed, inside the limits of its currency, is sent at once (status paid). Over the limits, or to someone not on the list, it returns status waiting_for_approval and an actionId; read the outcome with get_action. Reached by propose_payments or pay. With pay alone, a send that would need approval is refused (not_allowed) instead of becoming a proposal.",
    inputs: [
      { name: "toHandle", type: "string", required: true, note: "The HOLD @handle to pay: a to z, 0 to 9, _ . -, 2 to 50 characters, @ optional" },
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
    name: "propose_swap",
    scope: "propose_payments",
    title: "Propose a swap",
    readOnly: false,
    description: "Proposes converting one token into another. Nothing moves: HOLD opens its own convert screen filled in and the user confirms with Face ID.",
    inputs: SWAP_INPUTS,
  },
  {
    name: "propose_invest",
    scope: "propose_payments",
    title: "Propose an investment",
    readOnly: false,
    description:
      "Proposes putting dollars in Savings, or buying a tokenised stock from the user's USDC (HOLD checks the user can buy stocks where they live). Nothing moves until the user confirms in the app.",
    inputs: [
      { name: "product", type: '"savings" | "xstock"', required: true, note: "Savings to earn interest, or a tokenised stock" },
      { name: "symbol", type: "string", required: false, note: `savings: ${SAVINGS_TOKENS.join(", ")} (default USDC). xstock: ${XSTOCK_SYMBOLS.join(", ")}` },
      { name: "amount", type: MONEY, required: true, note: `Dollars. xstock: ${XSTOCK_BUY_MIN_USD} to ${XSTOCK_BUY_MAX_USD}` },
    ],
  },
  {
    name: "propose_withdraw_savings",
    scope: "propose_payments",
    title: "Propose taking money out of Savings",
    readOnly: false,
    description:
      "Proposes moving dollars from Savings back to the main account, from the stablecoin the user holds most of in Savings. Nothing moves until the user confirms in the app.",
    inputs: [{ name: "amount", type: MONEY, required: false, note: "Dollars. Leave it out to take all of that one stablecoin out; other stablecoins in Savings stay" }],
  },
  {
    name: "get_action",
    scope: "propose_payments",
    title: "Check a proposal",
    readOnly: true,
    description:
      "Reached by propose_payments or pay. The status of a proposal or a payment waiting for approval: pending, approved (HOLD is paying it now), completed (for a payment HOLD made, result has the payment and, for an x402 call, the paid response), failed (result.error says why), declined or expired (24 hours).",
    inputs: [{ name: "id", type: "uuid", required: true, note: "The id a propose_* tool returned, or the actionId of a payment waiting for approval" }],
  },
  {
    name: "pay_x402",
    scope: "pay",
    title: "Pay for an API (x402)",
    readOnly: false,
    description:
      "Fetches an https URL and, if it answers 402 Payment Required, pays it in USDC on Base from the user's HOLD balance: only allowed hostnames, within the per payment limit, the daily budget and maxAmount. Over a limit or on a site not on the list, nothing is paid and it returns status waiting_for_approval with an actionId; once the user approves, HOLD makes the call and pays it once, and get_action returns the response. If the paid call fails, the money goes back.",
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
    description:
      "paysEnabled, dailyBudget, spentToday (last 24 hours), perPaymentLimit, allowedDomains and remainingOnChain (what is left of the budget for every assistant), in USD. When the user set a euro budget, eur holds the same figures for euro sends.",
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
  /** Per assistant (connection): MCP_CALLS_PER_MINUTE and MCP_MESSAGES_PER_MINUTE. */
  callsPerMinute: 60,
  messagesPerMinute: 300,
  /** agents-oauth.router.ts: POST /oauth/register, per IP address. */
  registrationsPerHour: 20,
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
  { method: "GET | POST", path: "/x402/pay/@handle?amount=1.50", what: "Pay a HOLD user any amount from $0.01 to $1,000. The handle is a to z, 0 to 9, _ . -, 2 to 50 characters. Optional note (140 max) and ref (64 max)." },
  { method: "GET | POST", path: "/x402/link/:id", what: "Pay a HOLD payment link by its id or code (USD links on Base)." },
  { method: "GET", path: "/.well-known/x402", what: "The links their owners chose to list for agents." },
];
