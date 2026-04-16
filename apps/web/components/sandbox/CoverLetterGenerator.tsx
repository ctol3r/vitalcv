"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Sparkles, Loader2, Copy, Check, ArrowLeft, Send } from "lucide-react";
import { generateCoverLetter } from "@/components/sandbox/services/geminiService";

export default function CoverLetterGenerator({ onBack }: { onBack: () => void }) {
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!resume || !jobDescription) {
      setError("Please provide both your resume and the job description.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await generateCoverLetter(resume, jobDescription);
      setCoverLetter(result);
    } catch (err: any) {
      setError(err.message || "Failed to generate cover letter.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8 pb-24">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-ink/5 rounded-full transition-colors border border-line/20"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-3xl font-bold tracking-tighter uppercase">AI Cover Letter Generator</h2>
          <p className="text-xs font-mono opacity-40 uppercase tracking-widest">Tailored clinical narratives in seconds</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 flex items-center gap-2 text-ink">
              <FileText className="w-3 h-3" /> Your Resume / Experience
            </label>
            <textarea
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder="Paste your resume text or clinical experience summary here..."
              className="w-full h-48 bg-white/5 border border-line p-4 text-sm font-mono focus:outline-none focus:border-ink transition-colors resize-none text-ink"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 flex items-center gap-2 text-ink">
              <Send className="w-3 h-3" /> Job Description
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description you're applying for..."
              className="w-full h-48 bg-white/5 border border-line p-4 text-sm font-mono focus:outline-none focus:border-ink transition-colors resize-none text-ink"
            />
          </div>

          {error && <p className="text-xs text-red-500 font-mono">{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-ink text-bg py-4 font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Narrative...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Tailored Letter
              </>
            )}
          </button>
        </div>

        {/* Output Section */}
        <div className="relative min-h-[400px]">
          <AnimatePresence mode="wait">
            {coverLetter ? (
              <motion.div
                key="output"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full flex flex-col"
              >
                <div className="flex justify-between items-center mb-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 text-ink">Generated Cover Letter</label>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity text-ink"
                  >
                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied" : "Copy to Clipboard"}
                  </button>
                </div>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  className="flex-1 w-full bg-white/5 border border-line p-6 text-sm font-mono leading-relaxed focus:outline-none focus:border-ink transition-colors resize-none text-ink"
                />
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full border border-line border-dashed flex flex-col items-center justify-center p-12 text-center opacity-20"
              >
                <Sparkles className="w-12 h-12 mb-4 text-ink" />
                <p className="text-xs font-mono uppercase tracking-widest text-ink">Your tailored cover letter will appear here</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
