"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(2px)" },
  visible: (custom: number = 0) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: "easeOut", delay: 0.1 * custom },
  }),
};

/* Imports según tu estructura real */
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { TextField } from "@/ui/components/TextField";

/* Iconos de Subframe */
import {
  FeatherCheck,
  FeatherLinkedin,
  FeatherMenu,
  FeatherMessageCircle,
  FeatherTwitter,
} from "@subframe/core";


export default function Home() {
  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-center overflow-auto bg-gradient-to-b from-[#060B10] to-[#0B1520]">
        <div className="flex w-full flex-col items-center justify-center bg-[#0a141e66] px-6 py-6 sticky top-0 z-50 backdrop-blur-xl transition-all duration-300 mobile:px-2 mobile:py-2">
          <div className="flex w-full max-w-[1280px] items-center justify-between rounded-2xl bg-[#0a141e26] px-8 py-4 shadow-lg backdrop-blur-2xl border-b border-[rgba(255,255,255,0.12)] border-t-2 border-t-brand-600 mobile:hidden">
            <span className="font-['Inter'] text-[24px] font-[700] leading-[28px] text-[#eaf6ffff] -tracking-[0.02em]">
              HIHODL
            </span>
            <div className="flex items-center gap-6">
              <span className="font-['Inter'] text-[15px] font-[500] leading-[20px] text-brand-600 cursor-pointer transition">
                Features
              </span>
              <span className="font-['Inter'] text-[15px] font-[500] leading-[20px] text-brand-600 cursor-pointer transition">
                Pricing
              </span>
              <span className="font-['Inter'] text-[15px] font-[500] leading-[20px] text-brand-600 cursor-pointer transition">
                About
              </span>
              <span className="font-['Inter'] text-[15px] font-[500] leading-[20px] text-brand-600 cursor-pointer transition">
                Support
              </span>
            </div>
            <Button
              className="hover:shadow-[0_0_28px_rgba(245,217,10,0.5)] hover:shadow-[0_0_28px_rgba(245,217,10,0.5)]:hover inline-flex items-center px-6 py-3 rounded-xl text-black font-['Inter'] font-[700] bg-brand-600 transition-all duration-300"
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
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
        <motion.section
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          custom={1}
          className="flex w-full flex-col items-center justify-center gap-8 px-6 pt-32 pb-24 relative mobile:px-6 mobile:pt-24 mobile:pb-16"
        >
          <div className="flex h-192 w-full max-w-[1280px] flex-none items-start absolute inset-0 top-0 left-1/2 -translate-x-1/2 bg-[radial-gradient(circle_at_center,rgba(245,217,10,0.12)_0%,transparent_70%)] pointer-events-none" />
          <div className="flex w-full max-w-[1280px] flex-col items-center justify-center gap-8 relative z-10">
            <span className="max-w-[1024px] whitespace-pre-wrap font-['Inter'] text-[64px] font-[700] leading-[68px] text-default-font text-center -tracking-[0.05em] mobile:font-['Afacad_Flux'] mobile:text-[40px] mobile:font-[400] mobile:leading-[44px] mobile:tracking-normal">
              {"Be the First to Experience the Future of Wallets"}
            </span>
            <span className="max-w-[768px] whitespace-pre-wrap font-['Inter'] text-[18px] font-[400] leading-[28px] text-[#94a3b8ff] text-center -tracking-[0.01em]">
              {
                "Say goodbye to complicated wallets, seed phrases, and endless confusion. With HIHODL, a fully self-custodial wallet that feels like fintech. No native gas hurdles, multichain, clean UX, custom usernames instead of long addresses, and privacy through automatic wallet address rotation."
              }
            </span>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Button
                className="hover:shadow-[0_0_28px_rgba(245,217,10,0.5)] hover:shadow-[0_0_28px_rgba(245,217,10,0.5)]:hover inline-flex items-center px-6 py-3 rounded-xl text-black font-['Inter'] font-[700] bg-brand-600 transition-all duration-300"
                size="large"
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Join Beta Waitlist
              </Button>
              <Button
                className="border px-6 py-3 rounded-xl border-[rgba(255,255,255,0.1)] bg-[rgba(10,20,30,0.60)] backdrop-blur-xl text-[#EAF6FF] transition"
                variant="neutral-secondary"
                size="large"
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Explore Features
              </Button>
            </div>
          </div>
        </motion.section>
        <motion.section
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          custom={2}
          className="flex w-full flex-col items-center justify-center px-6 py-16"
        >
          <div className="flex h-112 w-full max-w-[1280px] flex-none flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl bg-[#0a141ea6] border border-[rgba(255,255,255,0.08)] backdrop-blur-xl mobile:h-80 mobile:w-full mobile:max-w-[1280px]">
  <img
    className="h-256 w-256 flex-none object-contain"
    src="https://res.cloudinary.com/subframe/image/upload/v1761474953/uploads/29066/t2gqf2i59sktauzsxrfv.png"
  />
</div>
        </motion.section>
        <motion.section
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          custom={3}
          className="flex w-full flex-col items-center justify-center gap-12 px-6 py-32 mobile:px-6 mobile:py-24"
        >
          <div className="flex w-full max-w-[1280px] flex-col items-center justify-center gap-4">
            <span className="font-['Inter'] text-[48px] font-[700] leading-[52px] text-[#eaf6ffff] text-center -tracking-[0.04em] mobile:font-['Afacad_Flux'] mobile:text-[36px] mobile:font-[400] mobile:leading-[40px] mobile:tracking-normal">
              Key Features
            </span>
          </div>
          <div className="flex w-full max-w-[1280px] flex-wrap gap-6 items-stretch justify-center mobile:flex-col mobile:flex-wrap mobile:gap-6">
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="flex min-w-[288px] grow shrink-0 basis-0 flex-col items-start gap-6 self-stretch rounded-2xl bg-[#0a141ea6] px-8 py-12 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl">
                <div className="flex h-48 w-full flex-none flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl relative">
                  <Image
                    src="https://storage.tally.so/5108bd11-0cbd-493d-bf63-ddeaefe88409/pexels-mareklevak-2265482.jpg"
                    alt="Feature: Fintech-Smooth Self-Custody"
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex w-full flex-col items-start gap-3">
                  <span className="font-['Inter'] text-[24px] font-[700] leading-[28px] text-[#eaf6ffff] -tracking-[0.02em]">
                    Fintech-Smooth Self-Custody
                  </span>
                  <span className="whitespace-pre-wrap font-['Inter'] text-[16px] font-[400] leading-[24px] text-[#94a3b8ff] -tracking-[0.01em]">
                    {
                      "Experience true ownership with a wallet that feels as effortless as your favorite finance app, no seed phrase stress or technical\n              clutter."
                    }
                  </span>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="flex min-w-[288px] grow shrink-0 basis-0 flex-col items-start gap-6 self-stretch rounded-2xl bg-[#0a141ea6] px-8 py-12 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl">
                <div className="flex h-48 w-full flex-none flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl relative">
                  <Image
                    src="https://storage.tally.so/4df50427-5b94-48b0-8121-eecfd69e58b7/pexels-mikhail-nilov-6893329.jpg"
                    alt="Feature: Unified, Clean Interface"
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex w-full flex-col items-start gap-3">
                  <span className="font-['Inter'] text-[24px] font-[600] leading-[28px] text-[#eaf6ffff] -tracking-[0.02em]">
                    Unified, Clean Interface
                  </span>
                  <span className="font-['Inter'] text-[16px] font-[400] leading-[24px] text-[#94a3b8ff] -tracking-[0.01em]">
                    Manage all your crypto activity in one beautifully designed
                    dashboard that&apos;s simple for newcomers and powerful for
                    pros.
                  </span>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="flex min-w-[288px] grow shrink-0 basis-0 flex-col items-start gap-6 self-stretch rounded-2xl bg-[#0a141ea6] px-8 py-12 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl">
                <div className="flex h-48 w-full flex-none flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl relative">
                  <Image
                    src="https://storage.tally.so/30340f0c-5d1a-4173-969f-b54a76fb20f6/pexels-mareklevak-2265482.jpg"
                    alt="Feature: Gasless Multichain Transactions"
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex w-full flex-col items-start gap-3">
                  <span className="font-['Inter'] text-[24px] font-[700] leading-[28px] text-[#eaf6ffff] -tracking-[0.02em]">
                    Gasless Multichain Transactions
                  </span>
                  <span className="font-['Inter'] text-[16px] font-[400] leading-[24px] text-[#94a3b8ff] -tracking-[0.01em]">
                    Send, receive, and interact across multiple blockchains
                    without worrying about native gas tokens or network hurdles.
                  </span>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="flex min-w-[288px] grow shrink-0 basis-0 flex-col items-start gap-6 self-stretch rounded-2xl bg-[#0a141ea6] px-8 py-12 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl">
                <div className="flex w-full flex-col items-start gap-3">
                  <span className="font-['Inter'] text-[24px] font-[700] leading-[28px] text-[#eaf6ffff] -tracking-[0.02em]">
                    Privacy That Evolves With You
                  </span>
                  <span className="font-['Inter'] text-[16px] font-[400] leading-[24px] text-[#94a3b8ff] -tracking-[0.01em]">
                    Enjoy seamless address rotation and custom wallet usernames
                    that keep your wallet activity private and your experience
                    personal.
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>
        <motion.section
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          custom={4}
          className="flex w-full flex-col items-center justify-center gap-12 px-6 py-32 mobile:px-6 mobile:py-24"
        >
          <div className="flex w-full max-w-[1280px] flex-col items-center justify-center gap-4">
            <span className="font-['Inter'] text-[48px] font-[700] leading-[52px] text-[#eaf6ffff] text-center -tracking-[0.04em] mobile:font-['Afacad_Flux'] mobile:text-[36px] mobile:font-[400] mobile:leading-[40px] mobile:tracking-normal">
              How It Works
            </span>
            <span className="max-w-[768px] font-['Inter'] text-[18px] font-[400] leading-[26px] text-[#94a3b8ff] text-center -tracking-[0.01em]">
              Getting started with HiHODL is simple and secure
            </span>
          </div>
          <div className="flex w-full max-w-[1280px] flex-col items-center justify-center gap-6">
            <div className="flex w-full flex-wrap items-start gap-6 mobile:flex-col mobile:flex-wrap mobile:gap-6">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-6 rounded-2xl px-8 py-12 border bg-gradient-to-br from-[rgba(245,217,10,0.08)] via-[rgba(10,20,30,0.60)] to-[rgba(10,20,30,0.60)] backdrop-blur-xl"
              >
                <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-brand-600">
                  <span className="font-['Inter'] text-[28px] font-[700] leading-[28px] text-black">
                    1
                  </span>
                </div>
                <div className="flex w-full flex-col items-start gap-3">
                  <span className="font-['Inter'] text-[22px] font-[700] leading-[26px] text-[#eaf6ffff] -tracking-[0.02em]">
                    Create your wallet
                  </span>
                  <span className="font-['Inter'] text-[16px] font-[400] leading-[24px] text-[#94a3b8ff] -tracking-[0.01em]">
                    No visible seed phrase in UI. Your wallet is secured with
                    advanced cryptography.
                  </span>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-6 rounded-2xl px-8 py-12 border bg-gradient-to-br from-[rgba(245,217,10,0.08)] via-[rgba(10,20,30,0.60)] to-[rgba(10,20,30,0.60)] backdrop-blur-xl"
              >
                <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-brand-600">
                  <span className="font-['Inter'] text-[28px] font-[700] leading-[28px] text-black">
                    2
                  </span>
                </div>
                <div className="flex w-full flex-col items-start gap-3">
                  <span className="font-['Inter'] text-[22px] font-[700] leading-[26px] text-[#eaf6ffff] -tracking-[0.02em]">
                    Get your 3 wallets
                  </span>
                  <span className="font-['Inter'] text-[16px] font-[400] leading-[24px] text-[#94a3b8ff] -tracking-[0.01em]">
                    Daily, Savings, and Social wallets help you organize your
                    crypto effortlessly.
                  </span>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-6 rounded-2xl px-8 py-12 border bg-gradient-to-br from-[rgba(245,217,10,0.08)] via-[rgba(10,20,30,0.60)] to-[rgba(10,20,30,0.60)] backdrop-blur-xl"
              >
                <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-brand-600">
                  <span className="font-['Inter'] text-[28px] font-[700] leading-[28px] text-black">
                    3
                  </span>
                </div>
                <div className="flex w-full flex-col items-start gap-3">
                  <span className="font-['Inter'] text-[22px] font-[700] leading-[26px] text-[#eaf6ffff] -tracking-[0.02em]">
                    Send &amp; receive easily
                  </span>
                  <span className="font-['Inter'] text-[16px] font-[400] leading-[24px] text-[#94a3b8ff] -tracking-[0.01em]">
                    Use @alias for easy transfers with gasless transaction
                    quotas included.
                  </span>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>
        <motion.section
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          custom={5}
          className="flex w-full flex-col items-center justify-center gap-8 px-6 py-16 mobile:px-6 mobile:py-12"
        >
          <div className="flex w-full max-w-[1024px] flex-col items-center justify-center gap-6 rounded-3xl px-12 py-16 border-2 bg-gradient-to-br from-[rgba(245,217,10,0.12)] via-[rgba(10,20,30,0.70)] to-[rgba(10,20,30,0.70)] backdrop-blur-xl mobile:px-6 mobile:py-12">
            <div className="flex h-8 flex-none items-center gap-2 rounded-full bg-brand-600 px-4 py-2">
              <span className="font-['Inter'] text-[14px] font-[600] leading-[20px] text-[#060b10ff]">
                COMING SOON
              </span>
            </div>
            <span className="font-['Inter'] text-[36px] font-[700] leading-[40px] text-[#eaf6ffff] text-center -tracking-[0.03em] mobile:font-['Afacad_Flux'] mobile:text-[28px] mobile:font-[400] mobile:leading-[32px] mobile:tracking-normal">
              StableCard
            </span>
            <span className="max-w-[768px] font-['Inter'] text-[18px] font-[400] leading-[26px] text-[#94a3b8ff] text-center -tracking-[0.01em]">
              Spend crypto like fiat with a virtual and physical card linked to
              your wallet. Integrated directly into HiHODL.
            </span>
            <span className="font-['Inter'] text-[14px] font-[600] leading-[20px] text-[#00ffb0ff] -tracking-[0.01em]">
              Launching  soon
            </span>
          </div>
        </motion.section>
        <motion.section
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          custom={6}
          className="flex w-full flex-col items-center justify-center gap-8 px-6 py-32 mobile:px-6 mobile:py-24"
        >
          <div className="flex w-full max-w-[1280px] flex-col items-center justify-center gap-8 rounded-3xl px-12 py-24 border-2 bg-gradient-to-br from-[rgba(245,217,10,0.12)] via-[rgba(10,20,30,0.70)] to-[rgba(10,20,30,0.70)] backdrop-blur-xl mobile:px-6 mobile:py-16">
            <div className="flex flex-col items-center justify-center gap-6">
              <span className="max-w-[768px] font-['Inter'] text-[56px] font-[900] leading-[60px] text-[#eaf6ffff] text-center -tracking-[0.05em] mobile:font-['Afacad_Flux'] mobile:text-[40px] mobile:font-[400] mobile:leading-[44px] mobile:tracking-normal">
                Join our waitlist today
              </span>
              <span className="max-w-[768px] whitespace-pre-wrap font-['Inter'] text-[20px] font-[500] leading-[28px] text-[#94a3b8ff] text-center -tracking-[0.015em]">
                {
                  "Join the waitlist now and be among the first to experience HIHODL.\n            Simply enter your email below, and we'll keep you updated on our\n            progress and exclusive launch offers."
                }
              </span>
            </div>
            <div className="flex w-full max-w-[576px] flex-col items-start gap-6">
              <TextField className="h-auto w-full flex-none" label="" helpText="">
                <TextField.Input
                  placeholder="Enter your email address"
                  value=""
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {}}
                />
              </TextField>
              <div className="flex items-start gap-3">
                <div className="flex h-5 w-5 flex-none items-center justify-center rounded-md border border-solid border-brand-600 bg-[#0a141e99]">
                  <FeatherCheck className="text-body font-body text-brand-600" />
                </div>
                <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-[#94a3b8ff] -tracking-[0.01em]">
                  Yes, I would like to sign up for the waiting list.
                </span>
              </div>
              <span className="font-['Inter'] text-[13px] font-[400] leading-[19px] text-[#94a3b8ff]">
                For information about our privacy practices and commitment to
                protecting your privacy, check out our Privacy Policy.
              </span>
              <Button
                className="h-10 w-full flex-none hover:shadow-[0_0_28px_rgba(245,217,10,0.5)] hover:shadow-[0_0_28px_rgba(245,217,10,0.5)]:hover inline-flex items-center justify-center px-6 py-3 rounded-xl text-black font-['Inter'] font-[700] bg-brand-600 transition-all duration-300"
                size="large"
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Join Beta Waitlist
              </Button>
            </div>
          </div>
        </motion.section>
        <div className="flex w-full flex-col items-center px-6 py-12 border-t-2">
          <div className="flex w-full max-w-[1280px] flex-col items-start gap-12 rounded-2xl bg-[#0a141ea6] px-12 py-12 backdrop-blur-xl border border-[rgba(255,255,255,0.08)] mobile:px-6 mobile:py-8">
            <div className="flex w-full flex-wrap items-start justify-between mobile:flex-col mobile:flex-wrap mobile:justify-between">
              <div className="flex flex-col items-start gap-6">
                <span className="font-['Inter'] text-[24px] font-[700] leading-[28px] text-brand-600 -tracking-[0.02em]">
                  HiHODL
                </span>
                <span className="max-w-[320px] font-['Inter'] text-[14px] font-[400] leading-[20px] text-[#94a3b8ff] -tracking-[0.01em]">
                  The next-gen crypto wallet that feels like Revolut.
                  Self-custody, multichain, gasless.
                </span>
              </div>
              <div className="flex flex-wrap items-start gap-12">
                <div className="flex flex-col items-start gap-4">
                  <span className="font-['Inter'] text-[14px] font-[600] leading-[20px] text-[#eaf6ffff] -tracking-[0.01em]">
                    Product
                  </span>
                  <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-brand-600 -tracking-[0.01em] cursor-pointer transition">
                    Features
                  </span>
                  <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-brand-600 -tracking-[0.01em] cursor-pointer transition">
                    Pricing
                  </span>
                  <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-brand-600 -tracking-[0.01em] cursor-pointer transition">
                    Security
                  </span>
                </div>
                <div className="flex flex-col items-start gap-4">
                  <span className="font-['Inter'] text-[14px] font-[600] leading-[20px] text-[#eaf6ffff] -tracking-[0.01em]">
                    Company
                  </span>
                  <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-brand-600 -tracking-[0.01em] cursor-pointer transition">
                    About
                  </span>
                  <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-brand-600 -tracking-[0.01em] cursor-pointer transition">
                    Blog
                  </span>
                </div>
                <div className="flex flex-col items-start gap-4">
                  <span className="font-['Inter'] text-[14px] font-[600] leading-[20px] text-[#eaf6ffff] -tracking-[0.01em]">
                    Resources
                  </span>
                  <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-brand-600 -tracking-[0.01em] cursor-pointer transition">
                    Support
                  </span>
                  <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-brand-600 -tracking-[0.01em] cursor-pointer transition">
                    Privacy Policy
                  </span>
                  <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-brand-600 -tracking-[0.01em] cursor-pointer transition">
                    Terms of Service
                  </span>
                </div>
              </div>
            </div>
            <div className="flex w-full items-center justify-between pt-8 border-t border-[rgba(255,255,255,0.08)] mobile:flex-col mobile:flex-nowrap mobile:gap-4">
              <span className="font-['Inter'] text-[13px] font-[400] leading-[19px] text-[#94a3b8ff]">
                © 2025 HiHODL. All rights reserved.
              </span>
              <div className="flex items-center gap-4">
                <IconButton
                  size="small"
                  icon={<FeatherTwitter />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
                <IconButton
                  size="small"
                  icon={<FeatherLinkedin />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
                <IconButton
                  size="small"
                  icon={<FeatherMessageCircle />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}