"use client";

// The other half of the TransFi redirect pair. Reached when the payout could
// not be started, or the user backed out of the widget.
//
// No red anywhere on this page, on purpose. Red is reserved for hard errors in
// HOLD, and this is not one: nothing was taken, so the honest register is
// neutral and calm rather than alarming. The neutral slate treatment below is
// what carries that, not a colour that makes someone think they lost money.
//
// The one fact that matters most to a person who has just seen a payment fail
// is whether they have been charged. It is the first line for that reason.

import React from "react";
import { motion } from "framer-motion";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { Button } from "@/ui/components/Button";
import { FeatherInfo } from "@subframe/core";

export default function OfframpFailurePage() {
  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-center justify-center overflow-y-auto overflow-x-hidden bg-gradient-to-b from-[#060B10] to-[#0B1520]">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex w-full max-w-[640px] flex-col items-center justify-center gap-8 px-6 py-24"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10">
            <FeatherInfo className="text-[#94a3b8ff]" style={{ width: 48, height: 48 }} />
          </div>

          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="font-[&apos;Inter&apos;] text-4xl sm:text-5xl font-[700] text-[#eaf6ffff] -tracking-[0.05em]">
              This withdrawal did not go through
            </h1>
            <p className="font-[&apos;Inter&apos;] text-lg text-[#94a3b8ff] max-w-[480px]">
              Nothing left your account. Your balance is exactly where it was, and you
              can try again whenever you like.
            </p>
          </div>

          <div className="flex flex-col gap-4 w-full max-w-[400px]">
            <div className="rounded-xl bg-white/5 p-6 border border-[rgba(255,255,255,0.08)]">
              <h3 className="font-[&apos;Inter&apos;] text-lg font-[600] text-[#eaf6ffff] mb-3">
                Worth checking
              </h3>
              <ul className="space-y-2 text-left">
                <li className="flex items-start gap-2 text-[#94a3b8ff]">
                  <span className="text-[#64748b]">•</span>
                  <span>That the account details match your bank exactly</span>
                </li>
                <li className="flex items-start gap-2 text-[#94a3b8ff]">
                  <span className="text-[#64748b]">•</span>
                  <span>That the account is in your own name</span>
                </li>
                <li className="flex items-start gap-2 text-[#94a3b8ff]">
                  <span className="text-[#64748b]">•</span>
                  <span>That your verification is complete in the app</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                className="w-full hover:shadow-[0_0_28px_rgba(255,183,3,0.5)] inline-flex items-center justify-center px-6 py-3 rounded-xl text-black font-[&apos;Inter&apos;] font-[700] bg-brand-ffb703 transition-all duration-300"
                onClick={() => {
                  window.location.href = "/open";
                }}
              >
                Try again in HOLD
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
