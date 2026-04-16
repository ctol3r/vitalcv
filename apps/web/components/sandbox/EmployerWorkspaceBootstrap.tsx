"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Loader2, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Globe } from "lucide-react";
import axios from "axios";
import { cn } from "@/components/sandbox/lib/utils";

type BootstrapState = "idle" | "loading" | "needs_setup" | "done" | "error";

interface EmployerWorkspaceBootstrapProps {
  onComplete: (orgId: string) => void;
  orgId: string;
}

export default function EmployerWorkspaceBootstrap({ onComplete, orgId }: EmployerWorkspaceBootstrapProps) {
  const [state, setState] = useState<BootstrapState>("idle");
  const [formData, setFormData] = useState({ name: "", domain: "" });
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    checkWorkspace();
  }, [orgId]);

  const checkWorkspace = async () => {
    setState("loading");
    try {
      const response = await axios.get("/api/employer/workspace", {
        headers: { "x-organization-id": orgId }
      });
      if (response.data.status === "active") {
        if (response.data.name) {
          setFormData(prev => ({ ...prev, name: response.data.name }));
        }
        setState("done");
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setState("needs_setup");
      } else {
        setState("error");
        setErrorMsg("Failed to verify workspace status.");
      }
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("loading");
    try {
      await axios.post("/api/employer/workspace", formData, {
        headers: { "x-organization-id": orgId }
      });
      setState("done");
    } catch (error: any) {
      setState("error");
      setErrorMsg(error.response?.data?.error || "Failed to bootstrap workspace.");
    }
  };

  return (
    <div className="max-w-xl mx-auto w-full">
      <AnimatePresence mode="wait">
        {state === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="border border-line p-12 bg-white/5 backdrop-blur-md text-center space-y-6"
          >
            <div className="flex justify-center">
              <Loader2 className="w-12 h-12 animate-spin opacity-20" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight uppercase">Verifying Entity</h3>
              <p className="text-xs font-mono opacity-40 uppercase tracking-widest">Checking VcvEntity Registry...</p>
            </div>
          </motion.div>
        )}

        {state === "needs_setup" && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="border border-line bg-white/5 backdrop-blur-md overflow-hidden"
          >
            <div className="p-8 border-b border-line bg-white/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-ink text-bg rounded-sm">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight uppercase">Workspace Setup</h3>
                  <p className="text-[10px] font-mono opacity-40 uppercase tracking-widest">First-Time Pilot Registration</p>
                </div>
              </div>
              <p className="text-sm opacity-60 leading-relaxed">
                Your organization context <span className="font-mono text-ink/80">[{orgId}]</span> is not yet registered in the VitalCV network. Bootstrap your workspace to review clinician packets.
              </p>
            </div>

            <form onSubmit={handleSetup} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 flex items-center gap-2">
                    <Building2 className="w-3 h-3" /> Organization Name
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Sutter Health"
                    className="w-full bg-white/5 border border-line p-3 text-sm focus:outline-none focus:border-ink transition-colors font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 flex items-center gap-2">
                    <Globe className="w-3 h-3" /> Corporate Domain
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    placeholder="e.g. sutterhealth.org"
                    className="w-full bg-white/5 border border-line p-3 text-sm focus:outline-none focus:border-ink transition-colors font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-ink text-bg py-4 font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-opacity group"
              >
                Bootstrap Workspace <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="flex items-center gap-2 justify-center opacity-30 text-[8px] font-mono uppercase tracking-tighter">
                <ShieldCheck className="w-3 h-3" />
                Immutable Entity Record will be generated
              </div>
            </form>
          </motion.div>
        )}

        {state === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="border border-line p-12 bg-white/5 backdrop-blur-md text-center space-y-6"
          >
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full border border-green-500/20 flex items-center justify-center bg-green-500/10 text-green-500">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-bold tracking-tight uppercase">Workspace Active</h3>
              <p className="text-sm opacity-80 font-mono">
                {formData.name ? `${formData.name} has been successfully registered.` : "Your organization has been successfully registered."}
              </p>
            </div>
            <div className="pt-4">
              <button
                onClick={() => onComplete(orgId)}
                className="bg-ink text-bg px-8 py-3 font-bold uppercase tracking-widest text-[10px] inline-flex items-center gap-2 hover:opacity-90 transition-all"
              >
                Go to Review Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {state === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="border border-red-500/20 p-12 bg-red-500/5 backdrop-blur-md text-center space-y-6"
          >
            <div className="flex justify-center text-red-500">
              <AlertCircle className="w-12 h-12" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight uppercase text-red-500">Bootstrap Failed</h3>
              <p className="text-xs font-mono opacity-60 uppercase tracking-widest">{errorMsg}</p>
            </div>
            <button
              onClick={checkWorkspace}
              className="text-[10px] font-bold uppercase tracking-widest underline underline-offset-4 opacity-60 hover:opacity-100"
            >
              Retry Connection
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
