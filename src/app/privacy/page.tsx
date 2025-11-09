"use client";

import React from "react";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { Button } from "@/ui/components/Button";
import type { Metadata } from "next";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export default function PrivacyPage() {
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
              Privacy Policy
            </h1>
            <p className="text-base sm:text-lg text-[#94a3b8ff] font-['Inter'] font-[400]">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="flex flex-col gap-8 text-[#eaf6ffff] font-['Inter'] font-[400] leading-relaxed">
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">1. Introduction</h2>
              <p className="text-[#94a3b8ff]">
                Welcome to HIHODL (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy and ensuring you have a positive experience on our website and in using our products and services. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website hihodl.xyz or use our services.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">2. Information We Collect</h2>
              <div className="flex flex-col gap-3 text-[#94a3b8ff]">
                <div>
                  <h3 className="text-xl font-[600] text-[#eaf6ffff] mb-2">2.1 Information You Provide</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Email address when you join our waitlist</li>
                    <li>Referral information and codes</li>
                    <li>Any other information you voluntarily provide to us</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-[600] text-[#eaf6ffff] mb-2">2.2 Automatically Collected Information</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>IP address and browser type</li>
                    <li>Device information and operating system</li>
                    <li>Usage data and interaction patterns</li>
                    <li>Cookies and similar tracking technologies</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">3. How We Use Your Information</h2>
              <p className="text-[#94a3b8ff]">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>Provide, maintain, and improve our services</li>
                <li>Process your waitlist registration and manage referrals</li>
                <li>Send you updates, newsletters, and marketing communications (with your consent)</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Monitor and analyze usage patterns and trends</li>
                <li>Detect, prevent, and address technical issues and security threats</li>
                <li>Comply with legal obligations and enforce our terms</li>
              </ul>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">4. Information Sharing and Disclosure</h2>
              <p className="text-[#94a3b8ff]">
                We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li><strong>Service Providers:</strong> With trusted third-party service providers who assist us in operating our website and conducting our business</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                <li><strong>With Your Consent:</strong> When you have given us explicit permission to share your information</li>
              </ul>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">5. Data Security</h2>
              <p className="text-[#94a3b8ff]">
                We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">6. Your Rights and Choices</h2>
              <p className="text-[#94a3b8ff]">
                Depending on your location, you may have certain rights regarding your personal information, including:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>The right to access and receive a copy of your personal data</li>
                <li>The right to rectify inaccurate or incomplete information</li>
                <li>The right to request deletion of your personal data</li>
                <li>The right to object to or restrict processing of your data</li>
                <li>The right to data portability</li>
                <li>The right to withdraw consent at any time</li>
                <li>The right to opt-out of marketing communications</li>
              </ul>
              <p className="text-[#94a3b8ff] mt-2">
                To exercise these rights, please contact us at the email address provided below.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">7. Cookies and Tracking Technologies</h2>
              <p className="text-[#94a3b8ff]">
                We use cookies and similar tracking technologies to track activity on our website and store certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our website.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">8. Third-Party Links</h2>
              <p className="text-[#94a3b8ff]">
                Our website may contain links to third-party websites or services. We are not responsible for the privacy practices of these external sites. We encourage you to review the privacy policies of any third-party sites you visit.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">9. Children&apos;s Privacy</h2>
              <p className="text-[#94a3b8ff]">
                Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">10. International Data Transfers</h2>
              <p className="text-[#94a3b8ff]">
                Your information may be transferred to and maintained on computers located outside of your state, province, country, or other governmental jurisdiction where data protection laws may differ. By using our services, you consent to the transfer of your information to these facilities.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">11. Changes to This Privacy Policy</h2>
              <p className="text-[#94a3b8ff]">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">12. Contact Us</h2>
              <p className="text-[#94a3b8ff]">
                If you have any questions about this Privacy Policy, please contact us at:
              </p>
              <div className="bg-white/5 rounded-xl p-6 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl">
                <p className="text-[#eaf6ffff] font-[600] mb-2">HIHODL</p>
                <p className="text-[#94a3b8ff]">Email: privacy@hihodl.xyz</p>
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

