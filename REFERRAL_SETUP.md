# 🚀 HIHODL Referral Program Setup Guide

## Overview

This referral program allows users to join the waitlist, invite friends, and climb a leaderboard to unlock exclusive perks.

**Workflow:**
```
Twitter → hihodl.xyz/?ref=CODE → CTA Form → Email with referral link + Access to ranking
```

## 📋 Setup Steps

### 1. Database Setup (Supabase)

1. Go to your Supabase project SQL Editor
2. Run the SQL schema from `supabase-schema.sql`
3. Verify tables were created:
   - `waitlist_users`
   - `referral_events`

### 2. Environment Variables

Create a `.env.local` file (use `.env.example` as template):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key

# Resend (for emails)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=HIHODL <noreply@hihodl.xyz>
```

**Where to find:**
- **Supabase keys**: Supabase Dashboard → Settings → API
- **Resend key**: https://resend.com → API Keys

### 3. Features Implemented

#### ✅ API Routes
- `/api/waitlist/join` - Join waitlist with referral tracking
- `/api/leaderboard` - Get top 100 leaderboard
- `/api/milestones?email=...` - Get user milestones
- `/api/referral/stats?email=...` - Get user referral stats

#### ✅ Components
- `JoinWaitlist` - Form to join waitlist
- `Leaderboard` - Public leaderboard display
- `Milestones` - User milestone badges
- `ReferralDashboard` - Personal dashboard with stats

#### ✅ Middleware
- Automatically tracks `?ref=CODE` from URLs
- Stores referral code in cookie for 30 days

#### ✅ Email Integration
- Automatic welcome email with referral link
- Beautiful HTML email template
- Sent via Resend (configurable)

### 4. Pages

- **Homepage (`/`)**: Updated with new referral section
- **Leaderboard (`/leaderboard`)**: Dedicated leaderboard page

### 5. Milestones (Tiers)

- 🏗️ **Builders Club** - 3 referrals
- ⭐ **Priority Beta** - 10 referrals
- 🎯 **Alias Reservation** - 25 referrals
- 👑 **Ambassador** - 50 referrals
- 💎 **Legend** - 100 referrals

## 🎨 Copy Used

- **Hero**: "Early access isn't given. It's earned."
- **Sub**: "Invite friends, stack XP, climb the leaderboard."
- **CTA**: "Join Beta Waitlist"
- **Leaderboard**: "Top 100 Leaderboard"

## 🔒 Anti-Abuse Features

1. **Email deduplication** - One email = one account
2. **Domain validation** - No self-referrals from same email domain
3. **Cookie-based tracking** - 30-day expiration
4. **Idempotent joins** - Same email returns existing referral code

## 📧 Email Setup (Optional)

Emails are sent automatically when users join. To disable:

1. Remove `RESEND_API_KEY` from `.env.local`
2. Or comment out the email send in `/api/waitlist/join/route.ts`

## 🧪 Testing

1. **Test join**: Go to `/`, fill form, submit
2. **Test referral**: Use `/?ref=YOUR_CODE` and join again
3. **Test leaderboard**: Go to `/leaderboard`
4. **Test stats**: Enter email on leaderboard page

## 🚀 Deployment Checklist

- [ ] Run SQL schema in Supabase
- [ ] Add environment variables
- [ ] Verify Resend domain (for emails)
- [ ] Test referral flow end-to-end
- [ ] Verify cookies work in production

## 📝 Notes

- Referral codes are 8-character alphanumeric (lowercase)
- Leaderboard auto-refreshes every 15 seconds
- All API routes use proper error handling
- UI matches existing HIHODL design system

## 🐛 Troubleshooting

**Emails not sending?**
- Check Resend API key is correct
- Verify domain is verified in Resend
- Check server logs for errors

**Referrals not counting?**
- Verify `increment_referrals_count` function exists
- Check database logs for errors
- Ensure referral codes match (case-sensitive)

**Leaderboard empty?**
- Check RLS policies allow public read
- Verify `referrals_count` column exists
- Check API route logs

---

**Need help?** Check the code comments or reach out!


