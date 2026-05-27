"use client";

import React from "react";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { Button } from "@/ui/components/Button";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export default function DeleteAccountPage() {
  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-center overflow-y-auto overflow-x-hidden bg-gradient-to-b from-[#060B10] to-[#0B1520]">
        {/* ==== TOP BAR ==== */}
        <div className="flex w-full flex-col items-center justify-center bg-[#0a141e66] px-6 py-6 sticky top-0 z-50 backdrop-blur-xl transition-all duration-300 mobile:px-2 mobile:py-2 mb-6 md:mb-8">
          <div className="flex w-full max-w-[1280px] items-center justify-between rounded-2xl bg-[#0a141e26] px-8 py-4 shadow-lg backdrop-blur-2xl border-b border-[rgba(255,255,255,0.12)] border-t-2 border-t-brand-600 mobile:hidden">
            <a
              href="/"
              className="font-['Inter'] text-[24px] font-[700] leading-[28px] text-[#eaf6ffff] -tracking-[0.02em] hover:text-brand-ffb703 transition"
            >
              HIHODL
            </a>
            <Button
              className="hover:shadow-[0_0_28px_rgba(255,183,3,0.5)] inline-flex items-center px-6 py-3 rounded-xl text-black font-['Inter'] font-[700] bg-brand-ffb703 transition-all duration-300"
              onClick={() => (window.location.href = "/#waitlist")}
            >
              Join Beta
            </Button>
          </div>
        </div>

        {/* ==== CONTENT ==== */}
        <motion.section
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="flex w-full max-w-[900px] flex-col gap-8 px-4 sm:px-6 md:px-8 py-16 md:py-24"
        >
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-['Inter'] font-[700] -tracking-[0.05em] leading-tight text-[#eaf6ffff]">
              Delete your HIHODL account
            </h1>
            <p className="text-base sm:text-lg text-[#94a3b8ff] font-['Inter'] font-[400]">
              Last updated:{" "}
              {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="flex flex-col gap-8 text-[#eaf6ffff] font-['Inter'] font-[400] leading-relaxed">
            {/* ===== HIGHLIGHTED WARNING ===== */}
            <section
              className="flex flex-col gap-3 rounded-2xl border border-[rgba(239,68,68,0.32)] bg-[rgba(239,68,68,0.08)] p-6"
              aria-label="Important warning"
            >
              <h2 className="text-xl font-[700] text-[#FCA5A5]">
                Before you delete — back up your recovery phrase
              </h2>
              <p className="text-[#eaf6ffcc]">
                HIHODL is a non-custodial wallet. The keys to your funds live on
                your device, not on our servers. If you delete your account
                without first backing up your 12-word recovery phrase (and
                ideally moving any on-chain balances to another wallet), those
                funds will be{" "}
                <strong className="text-[#FCA5A5]">
                  permanently inaccessible
                </strong>{" "}
                — we cannot recover them for you.
              </p>
            </section>

            {/* ===== IN-APP DELETION ===== */}
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                Option 1 — Delete from inside the app (recommended)
              </h2>
              <p className="text-[#94a3b8ff]">
                The fastest way to permanently delete your account is directly
                from the HIHODL mobile app:
              </p>
              <ol className="list-decimal list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>Open the HIHODL app on your phone.</li>
                <li>
                  Open the side menu and go to{" "}
                  <span className="text-[#eaf6ffff] font-[600]">
                    Settings
                  </span>
                  .
                </li>
                <li>
                  Scroll to the bottom and tap{" "}
                  <span className="text-[#FCA5A5] font-[600]">
                    Delete account
                  </span>{" "}
                  under the “Account” section.
                </li>
                <li>
                  Back up your recovery phrase (tap “Back up recovery phrase”)
                  and confirm the two acknowledgements.
                </li>
                <li>
                  Authenticate with Face ID, Touch ID, or your device passcode,
                  then confirm the final dialog.
                </li>
              </ol>
              <p className="text-[#94a3b8ff]">
                Your account is deleted immediately and you are signed out on
                every device.
              </p>
            </section>

            {/* ===== EMAIL FALLBACK ===== */}
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                Option 2 — Request deletion by email
              </h2>
              <p className="text-[#94a3b8ff]">
                If you no longer have access to the app, send an email to{" "}
                <a
                  href="mailto:delete@hihodl.xyz?subject=Delete%20my%20HIHODL%20account"
                  className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition"
                >
                  delete@hihodl.xyz
                </a>{" "}
                from the email address associated with your account. Include
                the word <span className="font-[600]">“DELETE”</span> in the
                subject line.
              </p>
              <p className="text-[#94a3b8ff]">
                We will verify the request and complete the deletion within
                7 calendar days. You will receive a confirmation email when it
                is done.
              </p>
            </section>

            {/* ===== WHAT GETS DELETED ===== */}
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                What gets deleted
              </h2>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>Your profile, username, and email confirmations.</li>
                <li>All encrypted vault backups stored on our servers.</li>
                <li>
                  Passkeys, recovery codes, and push notification tokens.
                </li>
                <li>
                  Every active session — you are signed out on every device.
                </li>
                <li>
                  Local seed material and app data on the device that
                  triggered the deletion.
                </li>
              </ul>
            </section>

            {/* ===== WHAT IS KEPT ===== */}
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                What we keep (and why)
              </h2>
              <p className="text-[#94a3b8ff]">
                For legal, audit, and anti-fraud reasons, we retain a minimal
                anonymized record of certain activity:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>
                  On-chain transaction history attached to a soft-deleted user
                  identifier (no email, no name, no contact info).
                </li>
                <li>
                  Aggregated, non-identifiable usage analytics (e.g. event
                  counters).
                </li>
              </ul>
              <p className="text-[#94a3b8ff]">
                These records cannot be linked back to your identity or
                contacted.
              </p>
            </section>

            {/* ===== WHAT STAYS ON-CHAIN ===== */}
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                What stays on-chain
              </h2>
              <p className="text-[#94a3b8ff]">
                Your blockchain addresses and any balances they hold are not
                controlled by HIHODL. They stay on-chain forever. If you kept
                a backup of your recovery phrase, you can import it into any
                compatible wallet and regain access to those funds.
              </p>
            </section>

            {/* ===== TIMING ===== */}
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                How long it takes
              </h2>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>
                  <span className="text-[#eaf6ffff] font-[600]">
                    In-app deletion:
                  </span>{" "}
                  immediate.
                </li>
                <li>
                  <span className="text-[#eaf6ffff] font-[600]">
                    Email deletion:
                  </span>{" "}
                  within 7 calendar days.
                </li>
                <li>
                  <span className="text-[#eaf6ffff] font-[600]">
                    Backup retention:
                  </span>{" "}
                  encrypted database backups expire automatically within 30
                  days of deletion.
                </li>
              </ul>
            </section>

            {/* ===== CONTACT ===== */}
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                Questions
              </h2>
              <p className="text-[#94a3b8ff]">
                If you have any questions about deletion or your data, email us
                at{" "}
                <a
                  href="mailto:privacy@hihodl.xyz"
                  className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition"
                >
                  privacy@hihodl.xyz
                </a>
                . You can also review our{" "}
                <a
                  href="/privacy"
                  className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition"
                >
                  Privacy Policy
                </a>{" "}
                for full details on how we handle your information.
              </p>
            </section>
          </div>
        </motion.section>
      </div>
    </DefaultPageLayout>
  );
}
