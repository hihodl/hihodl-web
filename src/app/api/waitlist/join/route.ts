import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import {
  escapeHtml,
  ipRateLimit,
  signToken,
  validateDisplayName,
  validateEmail,
} from '@/lib/security';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);

// Validate the referral code format up-front so a junk cookie can't reach
// the DB. Matches our nanoid alphabet exactly.
const REFERRAL_CODE_RE = /^[0-9a-z]{8}$/;

export async function POST(req: NextRequest) {
  try {
    // ── Rate limit per IP — 5 signups / minute ─────────────────────────────
    // Without this an attacker scripts thousands of requests → thousands of
    // Resend emails sent ($) + sender-reputation damage to noreply@hihodl.xyz.
    // 5/min is generous for the realistic UX (a real user signs up once
    // and maybe retries on a typo) and tight enough to bound abuse cost.
    const limit = ipRateLimit(req, 'waitlist-join', { windowMs: 60_000, max: 5 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Too many signups. Try again in a minute.' },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(limit.retryAfterMs / 1000).toString(),
          },
        },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    // ── Strict input validation ────────────────────────────────────────────
    // Previously the route accepted ANY string for displayName, which then
    // got interpolated raw into the welcome email HTML — letting an attacker
    // POST `displayName: "</h1><a href='phish'>...</a><h1>"` and weaponise
    // our verified domain as a phishing relay. Validate + length-cap here,
    // escape at render time below.
    const email = validateEmail((body as any).email);
    const displayName = validateDisplayName((body as any).displayName);

    if (!email) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    }
    if (!displayName) {
      return NextResponse.json({ error: 'invalid_display_name' }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json({ error: 'server_config_error' }, { status: 500 });
    }

    const supabase = createSupabaseClient(true);

    // ── Read referrer cookie with strict format validation ─────────────────
    const referrerCookie = req.cookies.get('hihodl_ref')?.value ?? null;
    const referredBy = referrerCookie && REFERRAL_CODE_RE.test(referrerCookie)
      ? referrerCookie
      : null;

    // ── Atomic upsert (fixes SELECT-then-INSERT race) ──────────────────────
    // Two concurrent submissions of the same email both pass a non-atomic
    // existence check and the second hits the unique constraint, surfacing
    // a raw DB error to the user. `ignoreDuplicates: true` makes the second
    // call a no-op; we then SELECT to fetch the row whichever path won.
    const myCode = nanoid();

    const { error: upsertError } = await supabase
      .from('waitlist_users')
      .upsert(
        {
          email,
          display_name: displayName,
          referral_code: myCode,
          referred_by_code: referredBy,
          referrals_count: 0,
        },
        { onConflict: 'email', ignoreDuplicates: true },
      );

    if (upsertError) {
      console.error('Database upsert error:', upsertError);
      return NextResponse.json(
        { error: 'database_error', message: 'Could not save your signup. Please try again.' },
        { status: 500 },
      );
    }

    // Re-read the canonical row (handles both the "we just inserted" and
    // "duplicate ignored" cases without branching).
    const { data: user, error: readError } = await supabase
      .from('waitlist_users')
      .select('id, referral_code')
      .eq('email', email)
      .maybeSingle();

    if (readError || !user) {
      console.error('Database read error after upsert:', readError);
      return NextResponse.json(
        { error: 'database_error', message: 'Could not save your signup. Please try again.' },
        { status: 500 },
      );
    }

    const finalCode = user.referral_code;
    const isNewUser = finalCode === myCode;

    // ── Increment referrer count (only on new signups) ─────────────────────
    if (isNewUser && referredBy && referredBy !== finalCode) {
      const { data: referrer } = await supabase
        .from('waitlist_users')
        .select('referral_code, email')
        .eq('referral_code', referredBy)
        .maybeSingle();

      if (referrer) {
        // Anti-fraud (basic): block same-email-domain self-referrals. Cheap
        // arb between gmail.com / protonmail.com etc. is still possible —
        // proper IP/device dedup is a v1.1 follow-up.
        const referrerDomain = referrer.email.split('@')[1];
        const userDomain = email.split('@')[1];

        if (referrerDomain !== userDomain) {
          const { error: rpcError } = await supabase.rpc('increment_referrals_count', {
            p_ref_code: referredBy,
          });
          if (rpcError) console.error('Error incrementing referrals:', rpcError);

          const { error: insertError } = await supabase.from('referral_events').insert({
            referrer_code: referredBy,
            referred_user_id: user.id,
          });
          if (insertError) console.error('Error inserting referral event:', insertError);
        }
      }
    }

    // ── Mint a session token for stats/milestones reads ────────────────────
    // Stats and milestones endpoints used to be IDOR — anyone could query
    // anyone's referral data by email. Now they require this token in the
    // Authorization header. Token is HMAC-signed (7-day TTL), bound to
    // (userId, email). See lib/security.ts.
    let sessionToken: string | null = null;
    try {
      sessionToken = signToken({ userId: user.id, email });
    } catch (e) {
      // WAITLIST_TOKEN_SECRET missing — log loudly but don't block signup.
      // Stats page will simply require re-signup until the env is provisioned.
      console.error('Failed to mint session token:', e);
    }

    // Send welcome email asynchronously (only on new signups).
    if (isNewUser) {
      sendWelcomeEmail(email, displayName, finalCode).catch(console.error);
    }

    return NextResponse.json({
      ok: true,
      referralCode: finalCode,
      alreadyExists: !isNewUser,
      sessionToken,
    });
  } catch (e) {
    console.error('Error in waitlist join:', e);
    return NextResponse.json(
      { error: 'server_error', message: 'Could not save your signup. Please try again.' },
      { status: 500 },
    );
  }
}

// Helper to send welcome email via Resend.
async function sendWelcomeEmail(email: string, displayName: string, referralCode: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log('Resend not configured, skipping email');
    return;
  }

  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hihodl.xyz';
  const referralLink = `${siteUrl}/?ref=${referralCode}`;

  // CRITICAL: every interpolation into the HTML below must be escaped.
  // displayName is the only user-controlled field that flows into render;
  // referralLink is server-built from a server-generated nanoid; siteUrl is
  // server config. Escape defensively anyway.
  const safeName = escapeHtml(displayName);
  const safeLink = escapeHtml(referralLink);
  const safeSite = escapeHtml(siteUrl);

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'HOLD <noreply@hihodl.xyz>',
      to: email,
      subject: 'Welcome to HOLD Beta! 🚀',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A141E; color: #eaf6ff; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #0A141E; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="${safeSite}/logo-white.png" alt="HOLD" style="max-width: 200px; height: auto;" />
            </div>
            <h1 style="color: #FFB703; font-size: 32px; margin-bottom: 20px;">Welcome ${safeName}! 🎉</h1>
            <p style="font-size: 18px; line-height: 1.6; margin-bottom: 30px;">
              You're now part of the HOLD beta waitlist. Early access isn't given—it's earned.
            </p>
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
              Share your referral link to climb the leaderboard and unlock exclusive perks:
            </p>
            <div style="background: rgba(255, 255, 255, 0.1); padding: 24px; border-radius: 12px; margin: 30px 0;">
              <p style="margin: 0 0 12px; font-weight: 600;">Your Referral Link:</p>
              <a href="${safeLink}" style="color: #FFB703; word-break: break-all; text-decoration: none; font-size: 14px;">
                ${safeLink}
              </a>
            </div>
            <div style="margin: 30px 0;">
              <a href="${safeSite}/leaderboard" style="display: inline-block; background: #FFB703; color: #0A141E; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; text-align: center;">
                View Leaderboard →
              </a>
            </div>
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
              <h3 style="font-size: 18px; margin-bottom: 16px;">Milestones to Unlock:</h3>
              <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="margin-bottom: 12px;">🏗️ <strong>Builders Club</strong> — at 3 referrals</li>
                <li style="margin-bottom: 12px;">⭐ <strong>Priority Beta</strong> — at 10 referrals</li>
                <li style="margin-bottom: 12px;">🎯 <strong>Alias Reservation</strong> — at 25 referrals</li>
                <li style="margin-bottom: 12px;">👑 <strong>Ambassador</strong> — at 50 referrals</li>
                <li style="margin-bottom: 12px;">💎 <strong>Legend</strong> — at 100 referrals</li>
              </ul>
            </div>
            <p style="margin-top: 40px; font-size: 14px; color: #94a3b8; text-align: center;">
              See you at the top! 🚀<br/>
              The HOLD Team
            </p>
          </div>
        </body>
        </html>
      `,
    });
  } catch (error) {
    console.error('Error sending email:', error);
  }
}
