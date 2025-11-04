"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/TextField";
import Leaderboard from "@/components/Leaderboard";
import Milestones from "@/components/Milestones";
import ReferralDashboard from "@/components/ReferralDashboard";
import { FeatherXTwitter } from "@subframe/core";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export default function LeaderboardPage() {
  const [email, setEmail] = useState("");
  const [viewMode, setViewMode] = useState<"public" | "personal">("public");

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setViewMode("personal");
    }
  };

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

        {/* ==== HERO ==== */}
        <motion.section
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative flex w-full flex-col items-center justify-center gap-10 px-4 sm:px-6 md:px-8 pt-16 md:pt-24 pb-12 md:pb-16"
        >
          <div className="relative z-10 mx-auto w-full max-w-[1280px] flex flex-col items-center justify-center gap-6 px-4 sm:px-6 md:px-8">
            <h1 className="max-w-[1024px] text-center font-['Inter'] font-[700] -tracking-[0.05em] leading-tight text-default-font text-4xl sm:text-5xl md:text-6xl">
              Referral Leaderboard
            </h1>
            <p className="max-w-[768px] text-center font-['Inter'] font-[400] -tracking-[0.01em] text-[#94a3b8ff] text-base sm:text-lg md:text-xl leading-relaxed">
              Climb the ranks by inviting friends. Top 100 earners unlock exclusive perks.
            </p>
          </div>
        </motion.section>

        {/* ==== CONTENT ==== */}
        <div className="flex w-full max-w-[1280px] flex-col gap-8 px-4 sm:px-6 md:px-8 pb-24">
          {viewMode === "public" ? (
            <>
              {/* Email form to view personal stats */}
              <motion.div
                variants={fadeInUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="rounded-2xl bg-white/5 p-6 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl"
              >
                <h2 className="text-xl font-['Inter'] font-[700] text-[#eaf6ffff] mb-4">
                  View Your Stats
                </h2>
                <form onSubmit={handleEmailSubmit} className="flex gap-4">
                  <TextField className="flex-1" label="" helpText="">
                    <TextField.Input
                      type="email"
                      placeholder="Enter your email to view your stats"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </TextField>
                  <Button
                    type="submit"
                    className="px-6 py-3 rounded-xl text-black font-['Inter'] font-[700] bg-brand-ffb703"
                  >
                    View Stats
                  </Button>
                </form>
              </motion.div>

              <motion.div
                variants={fadeInUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <Leaderboard />
              </motion.div>
            </>
          ) : (
            <ReferralDashboard email={email} />
          )}
        </div>

        {/* ==== FOOTER ==== */}
        <div className="flex w-full flex-col items-center px-4 sm:px-6 md:px-8 py-12 border-t-2">
          <div className="flex w-full max-w-[1280px] flex-col items-center gap-6">
            <p className="text-center font-['Inter'] text-[14px] font-[400] leading-[20px] text-[#94a3b8ff]">
              Share on{" "}
              <a
                href="https://x.com/hiihodl"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-ffb703 hover:underline"
              >
                Twitter
              </a>{" "}
              to help spread the word!
            </p>
            <span className="font-['Inter'] text-[13px] font-[400] leading-[19px] text-[#94a3b8ff]">
              © 2025 HiHODL. All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}


