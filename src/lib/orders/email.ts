/**
 * The Founder Pass receipt.
 *
 * This exists because the confirmation screen tells the buyer a receipt is on
 * its way, and a screen that promises something the code does not do is how a
 * product loses the only thing it is selling here — being believed. Sent once,
 * from the settlement path, fire-and-forget so a mail outage can never unsettle
 * a paid order.
 *
 * Everything interpolated is escaped. Only `email` is user-supplied and it never
 * reaches the body, but the discipline is cheap and the alternative is finding
 * out later that something else does.
 */
import { escapeHtml } from "@/lib/security";
import { FOUNDER_PASS } from "@/lib/rates.config";
import { SITE_URL } from "./config";

export interface FounderReceipt {
  email: string;
  seatNumber: number;
  reference: string;
  priceUsd: number;
  txUrl?: string | null;
}

export async function sendFounderReceipt(receipt: FounderReceipt): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[founders] RESEND_API_KEY not set — receipt not sent", receipt.reference);
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  const seat = escapeHtml(String(receipt.seatNumber));
  const ref = escapeHtml(receipt.reference);
  const price = escapeHtml(receipt.priceUsd.toFixed(2));
  const waiver = FOUNDER_PASS.savingsFeeWaiverUpToUsd.toLocaleString("en-US");
  const share = FOUNDER_PASS.creatorReferralShareBps / 100;
  const points = FOUNDER_PASS.welcomeHiPoints.toLocaleString("en-US");
  const site = escapeHtml(SITE_URL);

  const txRow = receipt.txUrl
    ? `<tr><td style="padding:8px 0;color:#9BA3B0;">Transaction</td>
         <td style="padding:8px 0;text-align:right;">
           <a href="${escapeHtml(receipt.txUrl)}" style="color:#FFB703;">View on chain</a>
         </td></tr>`
    : "";

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "HOLD <noreply@hihodl.xyz>",
      to: receipt.email,
      subject: `You are founder number ${receipt.seatNumber}`,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:40px 20px;background:#141F2E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#F4F6FA;">
  <div style="max-width:560px;margin:0 auto;">
    <p style="margin:0 0 32px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#FFB703;">
      Founder Pass confirmed
    </p>

    <h1 style="margin:0 0 24px;font-size:32px;font-weight:200;letter-spacing:-.02em;line-height:1.2;">
      You are founder number <span style="color:#FFB703;">${seat}</span>.
    </h1>

    <p style="margin:0 0 32px;font-size:16px;line-height:1.6;color:#9BA3B0;">
      Your terms are fixed from today and they do not expire. Here is exactly what you now have.
    </p>

    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:32px;">
      <tr><td style="padding:8px 0;color:#9BA3B0;">Founder number</td>
          <td style="padding:8px 0;text-align:right;">#${seat}</td></tr>
      <tr><td style="padding:8px 0;color:#9BA3B0;">Paid</td>
          <td style="padding:8px 0;text-align:right;">$${price}</td></tr>
      <tr><td style="padding:8px 0;color:#9BA3B0;">Order</td>
          <td style="padding:8px 0;text-align:right;font-family:monospace;">${ref}</td></tr>
      ${txRow}
    </table>

    <div style="border-top:1px solid rgba(255,255,255,.08);padding-top:24px;">
      <p style="margin:0 0 16px;font-size:14px;color:#9BA3B0;">Working today:</p>
      <ul style="margin:0 0 32px;padding-left:20px;font-size:15px;line-height:1.8;color:#F4F6FA;">
        <li>The paid plan, for life. It will never bill you.</li>
        <li>No fee on what your savings earn, on balances up to $${waiver}.</li>
        <li>No FX markup, in every corridor.</li>
        <li>A permanent ${share}% share of the revenue anyone you introduce generates for us.</li>
        <li>${points} HiPoints, credited to your account.</li>
      </ul>

      <p style="margin:0 0 16px;font-size:14px;color:#9BA3B0;">When the card ships:</p>
      <ul style="margin:0 0 32px;padding-left:20px;font-size:15px;line-height:1.8;color:#F4F6FA;">
        <li>Your numbered card, first batch, no issuance fee.</li>
        <li>Double the cashback band, permanently.</li>
      </ul>
    </div>

    <div style="border:1px solid rgba(255,183,3,.3);background:rgba(255,183,3,.05);border-radius:12px;padding:20px;margin-bottom:32px;">
      <p style="margin:0;font-size:14px;line-height:1.6;color:#9BA3B0;">
        We have not given the card a date and we are not going to. If it has not shipped
        within ${FOUNDER_PASS.refundWindowMonths} months of today, reply to this email and
        we refund the full amount. Keep this receipt — your order reference is all we need.
      </p>
    </div>

    <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#9BA3B0;">
      We will write again with your invite to the founders room, where the feature queue
      gets published and founders rank it.
    </p>

    <p style="margin:0;font-size:13px;color:#5A6068;">
      Questions, or something here does not match what you were charged?
      Reply to this email. <a href="${site}/fees" style="color:#FFB703;">Every fee we charge</a> is on one page.
    </p>
  </div>
</body></html>`,
    });
  } catch (e) {
    console.error("[founders] receipt send failed", receipt.reference, e);
  }
}
