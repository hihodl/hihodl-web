"use client";

import React from "react";
import { motion } from "framer-motion";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { Button } from "@/ui/components/Button";
import { FeatherCheck } from "@subframe/core";

export default function ThankYouPage() {
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
            <h1 className="font-['Inter'] text-4xl sm:text-5xl font-[700] text-[#eaf6ffff] -tracking-[0.05em]">
              ¡Genial! Estás en la waitlist 🎉
            </h1>
            <p className="font-['Inter'] text-lg text-[#94a3b8ff] max-w-[480px]">
              Ve a comprobar tu email. Te hemos enviado tu link de referido único y acceso al ranking.
            </p>
          </div>

          <div className="flex flex-col gap-4 w-full max-w-[400px]">
            <div className="rounded-xl bg-white/5 p-6 border border-[rgba(255,255,255,0.08)]">
              <h3 className="font-['Inter'] text-lg font-[600] text-[#eaf6ffff] mb-3">
                ¿Qué sigue?
              </h3>
              <ul className="space-y-2 text-left">
                <li className="flex items-start gap-2 text-[#94a3b8ff]">
                  <span className="text-brand-ffb703">✓</span>
                  <span>Revisa tu email (incluye spam)</span>
                </li>
                <li className="flex items-start gap-2 text-[#94a3b8ff]">
                  <span className="text-brand-ffb703">✓</span>
                  <span>Comparte tu link de referido único</span>
                </li>
                <li className="flex items-start gap-2 text-[#94a3b8ff]">
                  <span className="text-brand-ffb703">✓</span>
                  <span>Sube en el leaderboard invitando amigos</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                className="w-full hover:shadow-[0_0_28px_rgba(255,183,3,0.5)] hover:shadow-[0_0_28px_rgba(255,183,3,0.5)]:hover inline-flex items-center justify-center px-6 py-3 rounded-xl text-black font-['Inter'] font-[700] bg-brand-ffb703 transition-all duration-300"
                onClick={() => {
                  window.location.href = "/leaderboard";
                }}
              >
                Ver Leaderboard
              </Button>
              <Button
                className="w-full border px-6 py-3 rounded-xl border-[rgba(255,255,255,0.1)] bg-[rgba(10,20,30,0.60)] backdrop-blur-xl text-[#EAF6FF] transition"
                variant="neutral-secondary"
                onClick={() => {
                  window.location.href = "/";
                }}
              >
                Volver al inicio
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </DefaultPageLayout>
  );
}

