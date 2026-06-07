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

export default function ESignPage() {
  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-center overflow-y-auto overflow-x-hidden bg-gradient-to-b from-[#060B10] to-[#0B1520]">
        {/* ==== TOP BAR ==== */}
        <div className="flex w-full flex-col items-center justify-center bg-[#0a141e66] px-6 py-6 sticky top-0 z-50 backdrop-blur-xl transition-all duration-300 mobile:px-2 mobile:py-2 mb-6 md:mb-8">
          <div className="flex w-full max-w-[1280px] items-center justify-between rounded-2xl bg-[#0a141e26] px-8 py-4 shadow-lg backdrop-blur-2xl border-b border-[rgba(255,255,255,0.12)] border-t-2 border-t-brand-600 mobile:hidden">
            <a href="/" className="font-['Inter'] text-[24px] font-[700] leading-[28px] text-[#eaf6ffff] -tracking-[0.02em] hover:text-brand-ffb703 transition">
              HIHODL
            </a>
            <Button
              className="hover:shadow-[0_0_28px_rgba(255,183,3,0.5)] hover:shadow-[0_0_28px_rgba(255,183,3,0.5)]:hover inline-flex items-center px-6 py-3 rounded-xl text-black font-['Inter'] font-[700] bg-brand-ffb703 transition-all duration-300"
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
              Electronic Communications &amp; Signatures Consent
            </h1>
            <p className="text-base sm:text-lg text-[#94a3b8ff] font-['Inter'] font-[400]">
              Last updated: June 7, 2026
            </p>
          </div>

          <div className="flex flex-col gap-8 text-[#eaf6ffff] font-['Inter'] font-[400] leading-relaxed">
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">1. Purpose</h2>
              <p className="text-[#94a3b8ff]">
                This consent (&quot;E-Sign Consent&quot;) explains how HIHODL provides agreements, disclosures, notices, and other communications electronically, and obtains your agreement and signatures electronically. By accepting it, you agree to transact with us, and to receive disclosures from us, in electronic form. This E-Sign Consent supplements our{" "}
                <a href="/terms" className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition">
                  Privacy Policy
                </a>
                .
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">2. Your Consent</h2>
              <p className="text-[#94a3b8ff]">
                By tapping &quot;I agree&quot; (or an equivalent action) where this E-Sign Consent is presented, you consent to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>Receive all Communications (defined below) electronically; and</li>
                <li>Use electronic records and electronic signatures in connection with the Services, and you agree that your electronic signature is the legal equivalent of your handwritten signature and is binding.</li>
              </ul>
              <p className="text-[#94a3b8ff]">
                &quot;Communications&quot; means any agreement, disclosure, notice, statement, receipt, record, policy, consent (including KYC and biometric-processing consents collected via our verification partner), and other information we provide to you or that you sign or submit in connection with the Services.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">3. Method of Delivery</h2>
              <p className="text-[#94a3b8ff]">
                We may provide Communications by:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>Displaying them in the HIHODL app or on our website</li>
                <li>Sending them to the email address associated with your account</li>
                <li>In-app notifications or messages</li>
                <li>Other electronic means we make available</li>
              </ul>
              <p className="text-[#94a3b8ff]">
                You agree that any of these methods constitutes good and effective delivery.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">4. Hardware and Software Requirements</h2>
              <p className="text-[#94a3b8ff]">
                To access and retain Communications, you need a compatible smartphone or device; a current operating system and the HIHODL app; a valid email account and email software; internet access; and sufficient storage or a printer to save or print Communications. By consenting, you confirm you have access to the necessary hardware and software and can access and retain Communications.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">5. Keeping Your Information Current</h2>
              <p className="text-[#94a3b8ff]">
                You must keep your contact information, including your email address, accurate and up to date. You can update it in the app. We are not responsible for non-delivery of Communications caused by an outdated or incorrect email address you provided.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">6. Withdrawing Consent</h2>
              <p className="text-[#94a3b8ff]">
                You may withdraw your consent to receive Communications electronically by contacting us at the email address below. Withdrawal is effective only after we have a reasonable period to process it.
              </p>
              <p className="text-[#94a3b8ff]">
                Because the Services are provided electronically, withdrawing this consent may mean you can no longer use some or all of the Services, including features that require electronic disclosures, agreements, or verification. Withdrawal does not affect the legal validity of Communications provided before withdrawal takes effect.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">7. Requesting Paper Copies</h2>
              <p className="text-[#94a3b8ff]">
                You may request a paper copy of any Communication we are legally required to provide by contacting us at the email address below. We may charge a reasonable fee for paper copies, except where prohibited by law. Requesting a paper copy does not, by itself, withdraw your consent to electronic Communications.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">8. Legal Effect</h2>
              <p className="text-[#94a3b8ff]">
                You acknowledge that your electronic consent and signatures are valid and enforceable under the U.S. Electronic Signatures in Global and National Commerce Act (ESIGN Act), the Uniform Electronic Transactions Act (UETA), and, as applicable, the EU eIDAS Regulation and other applicable electronic-transactions laws.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">9. Contact</h2>
              <p className="text-[#94a3b8ff]">
                If you have any questions about this E-Sign Consent, please contact us at:
              </p>
              <div className="bg-white/5 rounded-xl p-6 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl">
                <p className="text-[#eaf6ffff] font-[600] mb-2">HIHODL</p>
                <p className="text-[#94a3b8ff]">Email: legal@hihodl.xyz</p>
                <p className="text-[#94a3b8ff]">Website: https://hihodl.xyz</p>
              </div>
            </section>
          </div>
        </motion.section>

        {/* ==== FOOTER ==== */}
        <div className="flex w-full flex-col items-center px-4 sm:px-6 md:px-8 py-12 border-t-2 border-[rgba(255,255,255,0.08)] mt-8">
          <div className="flex w-full max-w-[1280px] flex-col items-center gap-6">
            <div className="flex gap-6">
              <a href="/privacy" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                Privacy
              </a>
              <a href="/terms" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                Terms
              </a>
              <a href="/e-sign" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                E-Sign Consent
              </a>
            </div>
            <span className="font-['Inter'] text-[13px] font-[400] leading-[19px] text-[#94a3b8ff]">
              © 2025 HiHODL. All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}
