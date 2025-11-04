"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";

import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { TextField } from "@/ui/components/TextField";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { FeatherCheck } from "@subframe/core";
import { FeatherInstagram } from "@subframe/core";
import { FeatherLinkedin } from "@subframe/core";
import { FeatherMenu } from "@subframe/core";
import { FeatherXTwitter } from "@subframe/core";
import JoinWaitlist from "@/components/JoinWaitlist";
import Leaderboard from "@/components/Leaderboard";

/* =====================
 * Motion variants
 * ===================== */
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(4px)" },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: "easeOut", delay: 0.08 * i },
  }),
};

const stagger: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const cardReveal: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: "easeOut" } },
};

function Home() {
  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-center overflow-y-auto overflow-x-hidden bg-gradient-to-b from-[#060B10] to-[#0B1520]">
        {/* ==== TOP BAR ==== */}
        <div className="flex w-full flex-col items-center justify-center bg-[#0a141e66] px-6 py-6 sticky top-0 z-50 backdrop-blur-xl transition-all duration-300 mobile:px-2 mobile:py-2 mb-6 md:mb-8">
          <div className="flex w-full max-w-[1280px] items-center justify-between rounded-2xl bg-[#0a141e26] px-8 py-4 shadow-lg backdrop-blur-2xl border-b border-[rgba(255,255,255,0.12)] border-t-2 border-t-brand-600 mobile:hidden">
            <span className="font-['Inter'] text-[24px] font-[700] leading-[28px] text-[#eaf6ffff] -tracking-[0.02em]">
              HIHODL
            </span>
            <Button
              className="hover:shadow-[0_0_28px_rgba(255,183,3,0.5)] hover:shadow-[0_0_28px_rgba(255,183,3,0.5)]:hover inline-flex items-center px-6 py-3 rounded-xl text-black font-['Inter'] font-[700] bg-brand-ffb703 transition-all duration-300"
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Join Beta
            </Button>
          </div>
          <div className="hidden w-full flex-col items-start gap-4 rounded-2xl bg-[#0a141e80] px-6 py-4 shadow-lg backdrop-blur-2xl border-b border-[rgba(255,255,255,0.12)] border-t-2 border-t-brand-600 mobile:flex">
            <div className="flex w-full items-center justify-between">
              <span className="font-['Inter'] text-[20px] font-[700] leading-[24px] text-[#eaf6ffff] -tracking-[0.02em]">
                HIHODL
              </span>
              <IconButton
                icon={<FeatherMenu />}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              />
            </div>
          </div>
        </div>

        {/* ==== HERO ==== */}
        <motion.section
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="relative flex w-full flex-col items-center justify-center gap-10 px-4 sm:px-6 md:px-8 pt-32 md:pt-52 pb-24 md:pb-32"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="h-full w-full bg-[radial-gradient(circle_at_center,rgba(245,217,10,0.15)_0%,transparent_60%)]" />
          </div>
          <div className="relative z-10 mx-auto w-full max-w-[1280px] flex flex-col items-center justify-center gap-6 sm:gap-8 px-4 sm:px-6 md:px-8">
            <motion.span
              variants={fadeInUp}
              custom={1}
              className="max-w-[1024px] text-center font-['Inter'] font-[700] -tracking-[0.05em] leading-tight text-default-font text-4xl sm:text-5xl md:text-6xl xl:text-7xl"
            >
              {"Be the First to Experience the Future of Wallets"}
            </motion.span>
            <motion.span
              variants={fadeInUp}
              custom={2}
              className="max-w-[768px] text-center font-['Inter'] font-[400] -tracking-[0.01em] text-[#94a3b8ff] text-base sm:text-lg md:text-xl leading-relaxed"
            >
              {
                "Say goodbye to complicated wallets, seed phrases, and endless confusion. With HIHODL, a fully self-custodial wallet that feels like fintech. No native gas hurdles, multichain, clean UX, custom usernames instead of long addresses, and privacy through automatic wallet address rotation."
              }
            </motion.span>
            <motion.div
              variants={fadeInUp}
              custom={3}
              className="flex items-center justify-center gap-4 pt-4 flex-wrap"
            >
              <Button
                className="hover:shadow-[0_0_28px_rgba(255,183,3,0.5)] hover:shadow-[0_0_28px_rgba(255,183,3,0.5)]:hover inline-flex items-center px-6 py-3 rounded-xl text-black font-['Inter'] font-[700] bg-brand-ffb703 transition-all duration-300 !opacity-100 focus:!opacity-100 active:!opacity-100 [&_*]:!opacity-100 [&_*]:!translate-y-0 [&_*]:!scale-100 [&_*]:!blur-0"
                style={{ opacity: 1 }}
                size="large"
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                  event.preventDefault();
                  document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Join Beta Waitlist
              </Button>
              <Button
                className="border px-6 py-3 rounded-xl border-[rgba(255,255,255,0.1)] bg-[rgba(10,20,30,0.60)] backdrop-blur-xl text-[#EAF6FF] transition !opacity-100 focus:!opacity-100 active:!opacity-100 [&_*]:!opacity-100 [&_*]:!translate-y-0 [&_*]:!scale-100 [&_*]:!blur-0"
                style={{ opacity: 1 }}
                variant="neutral-secondary"
                size="large"
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Explore Features
              </Button>
            </motion.div>
          </div>
        </motion.section>

        {/* ==== PRODUCT SHOT ==== */}
        <motion.section
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="relative flex w-full flex-col items-center justify-center rounded-md px-4 sm:px-6 md:px-8 py-12 md:py-16"
        >
          <motion.div
            variants={cardReveal}
            whileHover={{ y: -6 }}
            className="flex h-144 w-256 flex-none flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl relative z-10 mobile:h-80 mobile:w-full mobile:max-w-[1280px] mobile:flex-none bg-[#0a141ea6] border border-[rgba(255,255,255,0.08)] backdrop-blur-xl"
          >
            <div className="relative h-256 w-256 flex-none rounded-[20px] overflow-hidden">
              <Image
                className="object-contain"
                src="https://res.cloudinary.com/subframe/image/upload/v1761680947/uploads/29066/pgr7v1odabrmhejxozno.png"
                alt="HIHODL wallet interface preview"
                fill
                sizes="(max-width: 768px) 100vw, 1024px"
              />
            </div>
          </motion.div>
        </motion.section>

        {/* ==== KEY FEATURES ==== */}
        <motion.section
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          className="flex w-full flex-col items-center justify-center gap-12 px-4 sm:px-6 md:px-8 py-24 md:py-32"
        >
          <motion.div variants={fadeInUp} className="flex w-full max-w-[1280px] flex-col items-center justify-center gap-4">
            <span className="text-center font-['Inter'] font-[700] -tracking-[0.04em] text-3xl sm:text-4xl md:text-5xl text-[#eaf6ffff]">
              Key Features
            </span>
          </motion.div>
          <div className="flex w-full max-w-[1280px] gap-6 flex-wrap items-stretch justify-center mobile:flex-col mobile:flex-nowrap mobile:gap-6">
            {/* Card 1 */}
            <motion.div variants={cardReveal} whileHover={{ y: -6 }} className="flex min-w-[288px] grow shrink-0 basis-0 flex-col items-start gap-6 self-stretch rounded-2xl bg-[#0a141ea6] px-8 py-12 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl">
              <div className="relative flex h-48 w-full flex-none flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl">
                <Image
                  className="object-cover"
                  src="https://res.cloudinary.com/subframe/image/upload/v1761593629/uploads/29066/lpv9ql9unbr7nyabxstd.jpg"
                  alt="Fintech-smooth self-custody wallet interface"
                  fill
                  sizes="(max-width: 768px) 100vw, 288px"
                />
              </div>
              <div className="flex w-full flex-col items-start gap-3">
                <span className="font-['Inter'] text-[24px] font-[700] leading-[28px] text-[#eaf6ffff] -tracking-[0.02em]">Fintech-Smooth Self-Custody</span>
                <span className="whitespace-pre-wrap font-['Inter'] text-[16px] font-[400] leading-[24px] text-[#94a3b8ff] -tracking-[0.01em]">{"Experience true ownership with a wallet that feels as effortless as your favorite finance app, no seed phrase stress or technical\n clutter."}</span>
              </div>
            </motion.div>
            {/* Card 2 */}
            <motion.div variants={cardReveal} whileHover={{ y: -6 }} className="flex min-w-[288px] grow shrink-0 basis-0 flex-col items-start gap-6 self-stretch rounded-2xl bg-[#0a141ea6] px-8 py-12 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl">
              <div className="relative flex h-48 w-full flex-none flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl">
                <Image
                  className="object-cover"
                  src="https://res.cloudinary.com/subframe/image/upload/v1761634174/uploads/29066/la7rbsffelgkohnmll9x.png"
                  alt="Unified, clean interface dashboard"
                  fill
                  sizes="(max-width: 768px) 100vw, 288px"
                />
              </div>
              <div className="flex w-full flex-col items-start gap-3">
                <span className="font-['Inter'] text-[24px] font-[600] leading-[28px] text-[#eaf6ffff] -tracking-[0.02em]">Unified, Clean Interface</span>
                <span className="font-['Inter'] text-[16px] font-[400] leading-[24px] text-[#94a3b8ff] -tracking-[0.01em]">Manage all your crypto activity in one beautifully designed dashboard that&#39;s simple for newcomers and powerful for pros.</span>
              </div>
            </motion.div>
            {/* Card 3 */}
            <motion.div variants={cardReveal} whileHover={{ y: -6 }} className="flex min-w-[288px] grow shrink-0 basis-0 flex-col items-start gap-6 self-stretch rounded-2xl bg-[#0a141ea6] px-8 py-12 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl">
              <div className="flex w-full flex-col items-start gap-3">
                <div className="relative flex h-48 w-full flex-none flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl">
                  <Image
                    className="object-cover"
                    src="https://res.cloudinary.com/subframe/image/upload/v1761683382/uploads/29066/mccxhhijefre9w3wjc5u.png"
                    alt="Gasless multichain transactions interface"
                    fill
                    sizes="(max-width: 768px) 100vw, 288px"
                  />
                </div>
                <span className="font-['Inter'] text-[24px] font-[700] leading-[28px] text-[#eaf6ffff] -tracking-[0.02em]">Gasless Multichain Transactions</span>
                <span className="font-['Inter'] text-[16px] font-[400] leading-[24px] text-[#94a3b8ff] -tracking-[0.01em]">Send, receive, and interact across multiple blockchains without worrying about native gas tokens or network hurdles.</span>
              </div>
            </motion.div>
            {/* Card 4 */}
            <motion.div variants={cardReveal} whileHover={{ y: -6 }} className="flex min-w-[288px] grow shrink-0 basis-0 flex-col items-start gap-6 self-stretch rounded-2xl bg-[#0a141ea6] px-8 py-12 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl">
              <div className="flex w-full flex-col items-start gap-3">
                <div className="relative flex h-48 w-full flex-none flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl">
                  <Image
                    className="object-cover"
                    src="https://res.cloudinary.com/subframe/image/upload/v1761683195/uploads/29066/grvjdwuuvnwmx820rof6.jpg"
                    alt="Privacy features with address rotation"
                    fill
                    sizes="(max-width: 768px) 100vw, 288px"
                  />
                </div>
                <span className="font-['Inter'] text-[24px] font-[700] leading-[28px] text-[#eaf6ffff] -tracking-[0.02em]">Privacy That Evolves With You</span>
                <span className="font-['Inter'] text-[16px] font-[400] leading-[24px] text-[#94a3b8ff] -tracking-[0.01em]">Enjoy seamless address rotation and custom wallet usernames that keep your wallet activity private and your experience personal.</span>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ==== HOW IT WORKS ==== */}
        <motion.section
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="flex w-full flex-col items-center justify-center gap-12 px-4 sm:px-6 md:px-8 py-24 md:py-32"
        >
          <motion.div variants={fadeInUp} className="flex w-full max-w-[1280px] flex-col items-center justify-center gap-4">
            <span className="text-center font-['Inter'] font-[700] -tracking-[0.04em] leading-tight text-3xl sm:text-4xl md:text-5xl text-[#eaf6ffff]">
              How It Works
            </span>
            <span className="max-w-[768px] text-center font-['Inter'] font-[400] -tracking-[0.01em] text-[#94a3b8ff] text-base sm:text-lg md:text-xl leading-relaxed">
              Getting started with HIHODL is simple and secure
            </span>
          </motion.div>
          <div className="flex w-full max-w-[1280px] flex-col items-center justify-center gap-6">
            <div className="flex w-full items-start gap-6 flex-wrap mobile:flex-col mobile:flex-nowrap mobile:gap-6">
              {[1, 2, 3].map((n) => (
                <motion.div
                  key={n}
                  variants={cardReveal}
                  className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-6 rounded-2xl px-8 py-12 border bg-gradient-to-br from-[rgba(245,217,10,0.08)] via-[rgba(10,20,30,0.60)] to-[rgba(10,20,30,0.60)] backdrop-blur-xl"
                >
                  <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-shadow-cyan">
                    <span className="font-['Inter'] text-[28px] font-[700] leading-[28px] text-black">{n}</span>
                  </div>
                  {n === 1 && (
                    <div className="flex w-full flex-col items-start gap-3">
                      <span className="font-['Inter'] text-[22px] font-[700] leading-[26px] text-[#eaf6ffff] -tracking-[0.02em]">Create your wallet</span>
                      <span className="font-['Inter'] text-[16px] font-[400] leading-[24px] text-[#94a3b8ff] -tracking-[0.01em]">No visible seed phrase in UI. Your wallet is secured with advanced cryptography.</span>
                    </div>
                  )}
                  {n === 2 && (
                    <div className="flex w-full flex-col items-start gap-3">
                      <span className="font-['Inter'] text-[22px] font-[700] leading-[26px] text-[#eaf6ffff] -tracking-[0.02em]">Get your 3 wallets</span>
                      <span className="font-['Inter'] text-[16px] font-[400] leading-[24px] text-[#94a3b8ff] -tracking-[0.01em]">Daily, Savings, and Social wallets help you organize your crypto effortlessly.</span>
                    </div>
                  )}
                  {n === 3 && (
                    <div className="flex w-full flex-col items-start gap-3">
                      <span className="font-['Inter'] text-[22px] font-[700] leading-[26px] text-[#eaf6ffff] -tracking-[0.02em]">Send &amp; receive easily</span>
                      <span className="font-['Inter'] text-[16px] font-[400] leading-[24px] text-[#94a3b8ff] -tracking-[0.01em]">Use @alias for easy transfers with gasless transaction quotas included.</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ==== STABLECARD ==== */}
        <motion.section
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="flex w-full flex-col items-center justify-center gap-8 px-4 sm:px-6 md:px-8 py-12 md:py-16"
        >
          <motion.div variants={cardReveal} className="flex w-full max-w-[1024px] flex-col items-center justify-center gap-6 rounded-3xl px-12 py-16 border-2 bg-gradient-to-br from-[rgba(245,217,10,0.12)] via-[rgba(10,20,30,0.70)] to-[rgba(10,20,30,0.70)] backdrop-blur-xl mobile:px-6 mobile:py-12">
            <div className="flex h-8 flex-none items-center gap-2 rounded-full bg-brand-primary px-4 py-2">
              <span className="font-['Inter'] text-[14px] font-[600] leading-[20px] text-[#060b10ff]">COMING SOON</span>
            </div>
            <span className="font-['Inter'] text-[36px] font-[700] leading-[40px] text-[#eaf6ffff] text-center -tracking-[0.03em] mobile:font-['Afacad_Flux'] mobile:text-[28px] mobile:font-[400] mobile:leading-[32px] mobile:tracking-normal">StableCard</span>
            <span className="max-w-[768px] whitespace-pre-wrap font-['Inter'] text-[18px] font-[400] leading-[26px] text-[#94a3b8ff] text-center -tracking-[0.01em]">{"Spend crypto like fiat with a virtual and physical card linked to your\n          wallet. Integrated directly into HIHODL."}</span>
            <span className="font-['Inter'] text-[14px] font-[600] leading-[20px] text-[#00ffb0ff] -tracking-[0.01em]">Launching  soon</span>
          </motion.div>
        </motion.section>

        {/* ==== WAITLIST ==== */}
        <motion.section
          id="waitlist"
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="flex w-full flex-col items-center justify-center gap-8 px-4 sm:px-6 md:px-8 py-24 md:py-32"
        >
          <motion.div variants={cardReveal} className="flex w-full max-w-[1280px] flex-col items-center justify-center gap-8 rounded-3xl px-12 py-24 border-2 bg-gradient-to-br from-[rgba(245,217,10,0.12)] via-[rgba(10,20,30,0.70)] to-[rgba(10,20,30,0.70)] backdrop-blur-xl mobile:px-6 mobile:py-16">
            <div className="flex flex-col items-center justify-center gap-6">
              <span className="max-w-[768px] font-['Inter'] text-[56px] font-[900] leading-[60px] text-[#eaf6ffff] text-center -tracking-[0.05em] mobile:font-['Afacad_Flux'] mobile:text-[40px] mobile:font-[400] mobile:leading-[44px] mobile:tracking-normal">
                Early access isn&apos;t given. It&apos;s earned.
              </span>
              <span className="max-w-[768px] whitespace-pre-wrap font-['Inter'] text-[20px] font-[500] leading-[28px] text-[#94a3b8ff] text-center -tracking-[0.015em]">
                Invite friends, stack XP, climb the leaderboard. Join the waitlist and earn your way to priority beta access.
              </span>
            </div>
            <JoinWaitlist />
            <div className="mt-8 w-full max-w-[576px]">
              <Leaderboard />
            </div>
          </motion.div>
        </motion.section>

        {/* ==== FOOTER ==== */}
        <div className="flex w-full flex-col items-center px-4 sm:px-6 md:px-8 py-12 border-t-2">
          <div className="flex w-full max-w-[1280px] flex-col items-start gap-12 rounded-2xl bg-[#0a141ea6] px-6 sm:px-8 md:px-12 py-8 sm:py-10 md:py-12 backdrop-blur-xl border border-[rgba(255,255,255,0.08)]">
            <div className="flex w-full items-start justify-between flex-wrap mobile:flex-col mobile:flex-nowrap mobile:justify-between">
              <div className="flex flex-col items-start gap-6">
                <span className="font-['Inter'] text-[24px] font-[700] leading-[28px] text-brand-ffb703 -tracking-[0.02em]">HIHODL</span>
                <span className="max-w-[320px] whitespace-pre-wrap font-['Inter'] text-[14px] font-[400] leading-[20px] text-[#94a3b8ff] -tracking-[0.01em]">{"The next-gen crypto wallet that feels like Fintech. Self-custody, multichain, gasless."}</span>
              </div>
              <div className="flex items-start gap-12 flex-wrap">
                <div className="flex flex-col items-start gap-4">
                  <span className="font-['Inter'] text-[14px] font-[600] leading-[20px] text-[#eaf6ffff] -tracking-[0.01em]">Product</span>
                  <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-brand-ffb703 -tracking-[0.01em] cursor-pointer transition">Features</span>
                  <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-brand-ffb703 -tracking-[0.01em] cursor-pointer transition">Pricing</span>
                  <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-brand-ffb703 -tracking-[0.01em] cursor-pointer transition">Security</span>
                </div>
                <div className="flex flex-col items-start gap-4">
                  <span className="font-['Inter'] text-[14px] font-[600] leading-[20px] text-[#eaf6ffff] -tracking-[0.01em]">Company</span>
                  <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-brand-ffb703 -tracking-[0.01em] cursor-pointer transition">About</span>
                  <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-brand-ffb703 -tracking-[0.01em] cursor-pointer transition">Blog</span>
                </div>
                <div className="flex flex-col items-start gap-4">
                  <span className="font-['Inter'] text-[14px] font-[600] leading-[20px] text-[#eaf6ffff] -tracking-[0.01em]">Resources</span>
                  <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-brand-ffb703 -tracking-[0.01em] cursor-pointer transition">Support</span>
                  <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-brand-ffb703 -tracking-[0.01em] cursor-pointer transition">Privacy Policy</span>
                  <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-brand-ffb703 -tracking-[0.01em] cursor-pointer transition">Terms of Service</span>
                </div>
              </div>
            </div>
            <div className="flex w-full items-center justify-between pt-8 border-t border-[rgba(255,255,255,0.08)] mobile:flex-col mobile:flex-nowrap mobile:gap-4">
              <span className="font-['Inter'] text-[13px] font-[400] leading-[19px] text-[#94a3b8ff]">© 2025 HiHODL. All rights reserved.</span>
              <div className="flex items-center gap-4">
                <a
                  href="https://x.com/hiihodl"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X (Twitter) — @hiihodl"
                  title="X (Twitter) — @hiihodl"
                  className="inline-flex"
                >
                  <IconButton size="small" icon={<FeatherXTwitter />} />
                </a>
                <a
                  href="https://www.linkedin.com/company/hihodl"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn — HiHODL"
                  title="LinkedIn — HiHODL"
                  className="inline-flex"
                >
                  <IconButton size="small" icon={<FeatherLinkedin />} />
                </a>
                <a
                  href="https://www.instagram.com/hihodl/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram — @hihodl"
                  title="Instagram — @hihodl"
                  className="inline-flex"
                >
                  <IconButton size="small" icon={<FeatherInstagram />} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default Home;