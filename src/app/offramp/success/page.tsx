"use client";

// Where TransFi sends the user after its hosted widget.
//
// The URL is not optional and not cosmetic: TransFi rejects order creation
// without a successRedirectUrl, and until 2026-08-02 the backend was sending
// hihodl.com, a domain with no A record at all. Anyone finishing a payout
// landed on "could not resolve host".
//
// The copy deliberately does NOT say the money has arrived. This redirect
// fires when the widget closes, which is BEFORE settlement — the payout is
// still `initiated` at that point and can still fail. Saying "sent" here would
// be a lie roughly as often as a bank rejects a beneficiary.

import React from "react";
import { motion } from "framer-motion";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { Button } from "@/ui/components/Button";
import { FeatherCheck } from "@subframe/core";

export default function OfframpSuccessPage() {
  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-center justify-center overflow-y-auto overflow-x-hidden bg-gradient-to-b from-[#060B10] to-[#0B1520]">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex w-full max-w-[640px] flex-col items-center justify-center gap-8 px-6 py-24"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-ffb703/20">
            <FeatherCheck className="text-brand-ffb703" style={{ width: 48, height: 48 }} />
          </div>

          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="font-[&apos;Inter&apos;] text-4xl sm:text-5xl font-[700] text-[#eaf6ffff] -tracking-[0.05em]">
              Your withdrawal is on its way
            </h1>
            <p className="font-[&apos;Inter&apos;] text-lg text-[#94a3b8ff] max-w-[480px]">
              We have handed it to our payout partner. You can close this page — HOLD
              will tell you the moment it reaches your bank.
            </p>
          </div>

          <div className="flex flex-col gap-4 w-full max-w-[400px]">
            <div className="rounded-xl bg-white/5 p-6 border border-[rgba(255,255,255,0.08)]">
              <h3 className="font-[&apos;Inter&apos;] text-lg font-[600] text-[#eaf6ffff] mb-3">
                What happens next
              </h3>
              <ul className="space-y-2 text-left">
                <li className="flex items-start gap-2 text-[#94a3b8ff]">
                  <span className="text-brand-ffb703">✓</span>
                  <span>Your bank usually receives it within one business day</span>
                </li>
                <li className="flex items-start gap-2 text-[#94a3b8ff]">
                  <span className="text-brand-ffb703">✓</span>
                  <span>The status updates by itself in the app</span>
                </li>
                <li className="flex items-start gap-2 text-[#94a3b8ff]">
                  <span className="text-brand-ffb703">✓</span>
                  <span>If anything goes wrong, the money comes back to you</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                className="w-full hover:shadow-[0_0_28px_rgba(255,183,3,0.5)] inline-flex items-center justify-center px-6 py-3 rounded-xl text-black font-[&apos;Inter&apos;] font-[700] bg-brand-ffb703 transition-all duration-300"
                onClick={() => {
                  // /open bridges to hold:// and falls back to the store.
                  // No `to` param on purpose: the app opens at its root, and
                  // there is no published deep link for a withdrawal screen to
                  // point at yet.
                  window.location.href = "/open";
                }}
              >
                Open HOLD
              </Button>
              <Button
                className="w-full border px-6 py-3 rounded-xl border-[rgba(255,255,255,0.1)] bg-[rgba(10,20,30,0.60)] backdrop-blur-xl text-[#EAF6FF] transition"
                variant="neutral-secondary"
                onClick={() => {
                  window.location.href = "/";
                }}
              >
                Back to Home
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </DefaultPageLayout>
  );
}
