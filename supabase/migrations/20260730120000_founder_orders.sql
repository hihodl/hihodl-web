-- ============================================================================
-- Migration: 20260730120000_founder_orders.sql
-- Date: 2026-07-30
-- Purpose: the Founder Pass order book — 500 seats, three payment rails, one
--          order model.
--
-- ── SECURITY POSTURE ────────────────────────────────────────────────────────
-- These tables are SERVER-AUTHORITATIVE. Nothing in a browser may read or
-- write them, ever. Not with the anon key, not with a user JWT.
--
-- That takes TWO things, and shipping only the first is the bug we already had
-- once on this project: a table can sit behind RLS with zero policies and still
-- be fully readable, because RLS gates rows while GRANT gates the table. The
-- deny-all posture is therefore:
--
--     1. ENABLE ROW LEVEL SECURITY, and create ZERO policies.
--     2. REVOKE ALL from anon and authenticated — on the tables, the sequences
--        and the functions.
--
-- Only the service role (which bypasses RLS by design) reaches these, and it is
-- only ever held by the Next.js route handlers. See src/lib/orders/store.ts.
--
-- ── WHY ONE ADDRESS PER ORDER ───────────────────────────────────────────────
-- `address_index` comes from a sequence and is UNIQUE. An address is never
-- reused across orders, including expired ones. Two reasons:
--   * Attribution: the receiving address is the only thing binding an on-chain
--     transfer to a buyer. Reuse it and two payments become indistinguishable.
--   * Income privacy: one reused address publishes the entire Founder Pass
--     revenue line to anyone with a block explorer.
-- The sequence is monotonic and gap-tolerant on purpose — a crashed request
-- burns an index rather than handing the same one to the next order.
--
-- ── ORDER STATE MACHINE ─────────────────────────────────────────────────────
--   created ──▶ awaiting_payment ──▶ confirming ──▶ paid
--                     │                   │
--                     └──────▶ expired ◀──┘
--   paid ──▶ refunded
-- Documented in full in README.md.
-- ============================================================================

BEGIN;

-- ── Enum: the only states an order can ever be in ───────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_order_state') THEN
    CREATE TYPE public.founder_order_state AS ENUM (
      'created',           -- row exists, nothing issued yet
      'awaiting_payment',  -- address + quote issued, clock running
      'confirming',        -- funds seen on chain, below the confirmation bar
      'expired',           -- the 20-minute quote lapsed unpaid
      'paid',              -- settled, seat number assigned
      'refunded'           -- settled then returned
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_payment_rail') THEN
    CREATE TYPE public.founder_payment_rail AS ENUM (
      'stripe',            -- card, via Stripe Checkout
      'external_wallet',   -- MetaMask / Phantom, USDC, EIP-1193
      'onchain_transfer'   -- "Pay with HIHODL": QR + address, any wallet
    );
  END IF;
END $$;

-- ── Address index: monotonic, never reused, never recycled ──────────────────
CREATE SEQUENCE IF NOT EXISTS public.founder_order_address_index_seq
  AS BIGINT START WITH 0 MINVALUE 0 INCREMENT BY 1 NO CYCLE;

-- ── Founder number: assigned only when an order actually settles ────────────
-- Not at checkout. A seat held by an unpaid cart is reserved (see
-- founder_seats_taken) but does not consume a founder number, so numbering
-- stays dense across abandoned carts.
CREATE SEQUENCE IF NOT EXISTS public.founder_seat_number_seq
  AS INTEGER START WITH 1 MINVALUE 1 INCREMENT BY 1 NO CYCLE;

-- ── The order book ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.founder_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Opaque public handle. This is what appears in a URL; `id` never does.
  reference         TEXT UNIQUE NOT NULL,

  state             public.founder_order_state NOT NULL DEFAULT 'created',
  rail              public.founder_payment_rail NOT NULL,

  email             TEXT NOT NULL,

  -- Quote, locked at creation. Stored in cents so no float ever touches money.
  price_cents       INTEGER NOT NULL CHECK (price_cents > 0),
  currency          TEXT NOT NULL DEFAULT 'USD',
  -- True when this order was priced in the early tranche. Recorded rather than
  -- recomputed, so a later change to the tranche size cannot silently reprice
  -- an order that was already quoted.
  early_price       BOOLEAN NOT NULL DEFAULT FALSE,

  -- ── On-chain rails only ──────────────────────────────────────────────────
  -- NULL for Stripe. Enforced by the CHECK at the bottom of the table.
  chain             TEXT,               -- 'base' | 'polygon'
  token             TEXT,               -- 'USDC'
  -- USDC has 6 decimals; base units so no float ever touches an amount.
  amount_base_units BIGINT CHECK (amount_base_units IS NULL OR amount_base_units > 0),
  receiving_address TEXT,
  address_index     BIGINT UNIQUE,      -- UNIQUE is the no-reuse guarantee
  derivation_path   TEXT,
  -- Block height when the address was issued. The deposit watcher scans from
  -- here, so a transfer that predates the order can never be miscounted as
  -- payment for it.
  watch_from_block  BIGINT,
  paid_tx_hash      TEXT,
  confirmations     INTEGER NOT NULL DEFAULT 0,

  -- ── Stripe rail only ─────────────────────────────────────────────────────
  stripe_session_id        TEXT UNIQUE,
  stripe_payment_intent_id TEXT,

  -- ── Lifecycle ────────────────────────────────────────────────────────────
  -- The quote and the address are valid until this instant, then the order
  -- expires and a retry issues a brand new address.
  quote_expires_at  TIMESTAMPTZ NOT NULL,
  paid_at           TIMESTAMPTZ,
  refunded_at       TIMESTAMPTZ,

  -- Founder number, 1..500. Assigned on settlement by claim_founder_seat().
  seat_number       INTEGER UNIQUE CHECK (seat_number IS NULL OR (seat_number >= 1 AND seat_number <= 500)),

  referral_code     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- An on-chain order without an address is unpayable and unattributable.
  CONSTRAINT founder_orders_onchain_complete CHECK (
    rail = 'stripe'
    OR (
      chain IS NOT NULL
      AND token IS NOT NULL
      AND amount_base_units IS NOT NULL
      AND receiving_address IS NOT NULL
      AND address_index IS NOT NULL
    )
    OR state = 'created'   -- the brief window before the address is issued
  ),

  -- A paid order must carry a founder number, and vice versa.
  CONSTRAINT founder_orders_paid_has_seat CHECK (
    (state IN ('paid', 'refunded')) = (seat_number IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_founder_orders_state       ON public.founder_orders(state);
CREATE INDEX IF NOT EXISTS idx_founder_orders_email       ON public.founder_orders(email);
CREATE INDEX IF NOT EXISTS idx_founder_orders_expires     ON public.founder_orders(quote_expires_at)
  WHERE state IN ('created', 'awaiting_payment', 'confirming');
CREATE UNIQUE INDEX IF NOT EXISTS idx_founder_orders_address
  ON public.founder_orders(chain, lower(receiving_address))
  WHERE receiving_address IS NOT NULL;

-- ── updated_at ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.founder_orders_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS founder_orders_touch ON public.founder_orders;
CREATE TRIGGER founder_orders_touch
  BEFORE UPDATE ON public.founder_orders
  FOR EACH ROW EXECUTE FUNCTION public.founder_orders_touch();

-- ── Expiry, enforced in the database rather than hoped for in a cron ────────
-- Called at the top of every read path. An order past its quote window is
-- expired the moment anybody looks at it, so the seats counter is honest
-- without a scheduler.
CREATE OR REPLACE FUNCTION public.expire_stale_founder_orders()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  n INTEGER;
BEGIN
  UPDATE public.founder_orders
     SET state = 'expired'
   WHERE state IN ('created', 'awaiting_payment')
     AND quote_expires_at < NOW();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- ── Seats taken = settled + actively reserved ───────────────────────────────
-- A cart with a live quote holds a real seat: its address is issued and money
-- may already be in flight. Expired and refunded orders release theirs.
-- 'confirming' never expires here — funds are on chain, the clock stops
-- mattering, and releasing that seat would oversell the cap.
CREATE OR REPLACE FUNCTION public.founder_seats_taken()
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
    FROM public.founder_orders
   WHERE state = 'paid'
      OR state = 'confirming'
      OR (state IN ('created', 'awaiting_payment') AND quote_expires_at >= NOW());
$$;

-- ── Open an order: capacity check and address index, atomically ─────────────
-- Both decisions have to happen under one lock or two simultaneous buyers can
-- pass the capacity check together and oversell the last seat.
CREATE OR REPLACE FUNCTION public.open_founder_order(
  p_reference     TEXT,
  p_rail          public.founder_payment_rail,
  p_email         TEXT,
  p_total_seats   INTEGER,
  p_early_seats   INTEGER,
  p_price_cents   INTEGER,
  p_early_price_cents INTEGER,
  p_quote_minutes INTEGER,
  p_referral_code TEXT DEFAULT NULL
)
-- JSONB rather than RETURNS TABLE on purpose: RETURNS TABLE would declare
-- `reference`, `price_cents`, `early_price` and `address_index` as plpgsql
-- variables that shadow the identically-named columns of the very table this
-- function writes to. That is a trap waiting for the next person to add a WHERE
-- clause. One JSON object, no shadowing, and the caller gets an object instead
-- of a one-row set it has to unwrap.
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_taken     INTEGER;
  v_settled   INTEGER;
  v_index     BIGINT;
  v_price     INTEGER;
  v_early     BOOLEAN;
  v_expires   TIMESTAMPTZ;
  v_id        UUID;
BEGIN
  -- Serialise every order opening against every other one. At 500 seats total
  -- this costs nothing and removes the whole class of oversell races.
  PERFORM pg_advisory_xact_lock(hashtext('founder_orders_capacity'));

  PERFORM public.expire_stale_founder_orders();

  v_taken := public.founder_seats_taken();
  IF v_taken >= p_total_seats THEN
    RAISE EXCEPTION 'founder_sold_out' USING ERRCODE = 'check_violation';
  END IF;

  -- The early tranche is priced off SETTLED seats, not reserved ones: an
  -- abandoned cart must not push the next real buyer up to the full price.
  SELECT COUNT(*)::INTEGER INTO v_settled
    FROM public.founder_orders WHERE state IN ('paid', 'refunded');

  v_early := v_settled < p_early_seats;
  v_price := CASE WHEN v_early THEN p_early_price_cents ELSE p_price_cents END;

  v_index   := nextval('public.founder_order_address_index_seq');
  v_expires := NOW() + make_interval(mins => p_quote_minutes);

  INSERT INTO public.founder_orders (
    reference, state, rail, email, price_cents, early_price,
    address_index, quote_expires_at, referral_code
  ) VALUES (
    p_reference, 'created', p_rail, p_email, v_price, v_early,
    v_index, v_expires, p_referral_code
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'order_id',      v_id,
    'reference',     p_reference,
    'address_index', v_index,
    'price_cents',   v_price,
    'early_price',   v_early,
    'expires_at',    v_expires
  );
END;
$$;

-- ── Settle an order and hand it its founder number ──────────────────────────
-- Idempotent: replaying a Stripe webhook or a second confirmation of the same
-- transfer returns the number already assigned instead of burning another one.
CREATE OR REPLACE FUNCTION public.claim_founder_seat(
  p_reference   TEXT,
  p_total_seats INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing INTEGER;
  v_state    public.founder_order_state;
  v_seat     INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('founder_orders_capacity'));

  SELECT seat_number, state INTO v_existing, v_state
    FROM public.founder_orders WHERE reference = p_reference FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'founder_order_not_found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;   -- replay: already settled
  END IF;

  v_seat := nextval('public.founder_seat_number_seq');
  IF v_seat > p_total_seats THEN
    RAISE EXCEPTION 'founder_sold_out' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.founder_orders
     SET state = 'paid', seat_number = v_seat, paid_at = NOW()
   WHERE reference = p_reference;

  RETURN v_seat;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- DENY-ALL. Both halves.
-- ═══════════════════════════════════════════════════════════════════════════

-- Half one: RLS on, zero policies. Any row read by a non-superuser role
-- matches no policy and is therefore invisible.
ALTER TABLE public.founder_orders ENABLE ROW LEVEL SECURITY;

-- Deliberately NOT `FORCE ROW LEVEL SECURITY`. FORCE only changes behaviour for
-- the table owner, which here is a superuser that bypasses RLS either way — so
-- it buys nothing against anon or authenticated, and it is one more thing that
-- could go wrong for the service role. The protection against the browser is
-- the zero policies plus the zero grants below, not FORCE.

-- Defensive: if an earlier revision of this file ever created a policy, drop it.
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'founder_orders'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.founder_orders', p.policyname);
  END LOOP;
END $$;

-- Half two: no GRANT. RLS gates rows, GRANT gates the table — leaving the
-- default grants in place is how a "deny-all" table stays readable.
REVOKE ALL ON public.founder_orders FROM anon, authenticated, PUBLIC;
REVOKE ALL ON SEQUENCE public.founder_order_address_index_seq FROM anon, authenticated, PUBLIC;
REVOKE ALL ON SEQUENCE public.founder_seat_number_seq        FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.open_founder_order(TEXT, public.founder_payment_rail, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.claim_founder_seat(TEXT, INTEGER)   FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_founder_orders()       FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.founder_seats_taken()               FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.founder_orders_touch()              FROM anon, authenticated, PUBLIC;

-- ...and then hand the one role that IS allowed here its access back explicitly.
-- Revoking from PUBLIC strips the implicit EXECUTE that every role inherits, so
-- without this the service role loses the functions too and every route 500s.
-- Stated rather than relied upon: the grant should be visible in the same file
-- as the revoke, not inferred from Supabase's default privileges.
GRANT SELECT, INSERT, UPDATE ON public.founder_orders TO service_role;
GRANT USAGE ON SEQUENCE public.founder_order_address_index_seq TO service_role;
GRANT USAGE ON SEQUENCE public.founder_seat_number_seq        TO service_role;
GRANT EXECUTE ON FUNCTION public.open_founder_order(TEXT, public.founder_payment_rail, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_founder_seat(TEXT, INTEGER)   TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_founder_orders()       TO service_role;
GRANT EXECUTE ON FUNCTION public.founder_seats_taken()               TO service_role;

-- No DELETE, deliberately. An order is a financial record: it is refunded, not
-- erased, and nothing in the application has a reason to remove one.

COMMENT ON TABLE public.founder_orders IS
  'Founder Pass order book. Server-authoritative: RLS on with zero policies AND no grants to anon/authenticated. Reachable only via the service role from the Next.js route handlers.';
COMMENT ON COLUMN public.founder_orders.address_index IS
  'Index on the treasury xpub external chain (m/44''/60''/A''/0/i). UNIQUE — an address is never reused across orders, for payment attribution and income privacy.';
COMMENT ON COLUMN public.founder_orders.seat_number IS
  'Founder number 1..500. Assigned at settlement, not at checkout.';

COMMIT;
