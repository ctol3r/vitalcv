import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Shield, CheckCircle2, Clock, AlertCircle, ArrowRight, FileText, User, Activity, Eye, Share2, Sun, Moon, Database } from "lucide-react";
import axios from "axios";
import { cn } from "@/components/sandbox/lib/utils";
import { analyzeReadiness } from "@/components/sandbox/services/geminiService";
import { fetchNPIData } from "@/components/sandbox/services/npiService";
import ReactMarkdown from "react-markdown";
import ClinicianPassport, { TrustState } from "@/components/sandbox/ClinicianPassport";
import EmployerReviewDashboard from "@/components/sandbox/EmployerReviewDashboard";
import ReadinessPreview from "@/components/sandbox/ReadinessPreview";
import LiveTrustConsole from "@/components/sandbox/LiveTrustConsole";
import EmployerWorkspaceBootstrap from "@/components/sandbox/EmployerWorkspaceBootstrap";
import EmployerNotifications from "@/components/sandbox/EmployerNotifications";
import CoverLetterGenerator from "@/components/sandbox/CoverLetterGenerator";
import { NPIDataResponse } from "@/components/sandbox/types/npi";

interface Source {
  name: string;
  status: string;
  details: string;
}

interface ReadinessData {
  npi: string;
  name: string;
  specialty: string;
  status: string;
  sources: Source[];
  readinessScore: number;
  estimatedStart: string;
}

export default function App() {
  const [npi, setNpi] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NPIDataResponse | null>(null);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<{
    verifiedCredentials: string;
    identifiedGaps: string;
    estimatedTimeToStart: string;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [viewMode, setViewMode] = useState<"clinician" | "employer" | "cover-letter">("clinician");
  const [showDemoEmployer, setShowDemoEmployer] = useState(false);
  const [showReviewRequest, setShowReviewRequest] = useState(false);
  const [workspaceActive, setWorkspaceActive] = useState(false);
  const [currentOrgId, setCurrentOrgId] = useState("ORG-SUTTER-001");
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("vitalcv_recent_npis");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [manualReviews, setManualReviews] = useState<string[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as "light" | "dark") || "light";
    }
    return "light";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Configure axios with organization context if in employer mode
  useEffect(() => {
    if (viewMode === "employer" || showDemoEmployer || showReviewRequest) {
      axios.defaults.headers.common["x-organization-id"] = currentOrgId;
    } else {
      delete axios.defaults.headers.common["x-organization-id"];
    }
  }, [viewMode, showDemoEmployer, showReviewRequest, currentOrgId]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"));
  };

  const handleSearch = async (e: React.FormEvent | null, overrideNpi?: string) => {
    if (e) e.preventDefault();
    const searchNpi = overrideNpi || npi;
    if (searchNpi.length !== 10) {
      setError("NPI must be 10 digits.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await fetchNPIData(searchNpi);
      setData(data);
      
      // Save to recent searches
      setRecentSearches(prev => {
        const updated = [searchNpi, ...prev.filter(id => id !== searchNpi)].slice(0, 5);
        localStorage.setItem("vitalcv_recent_npis", JSON.stringify(updated));
        return updated;
      });
      setShowSuggestions(false);
      
      // Trigger Gemini analysis
      setAnalyzing(true);
      const result = await analyzeReadiness(data);
      setAnalysis(result || "");
    } catch (err: any) {
      setError(err.message || "Failed to fetch data.");
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const mockEmployerPackets = [
    {
      clinicianName: "Dr. John Smith, MD",
      npi: "1234567890",
      specialty: "Internal Medicine",
      status: "Pending" as const,
      submissionDate: new Date().toISOString(),
      timeToStart: "14 Days",
      synthesis: {
        verifiedCredentials: "NPPES Identity confirmed. CA State License (MD12345678) active through 2027. OIG/LEIE clear as of 2026-03-30.",
        identifiedGaps: "PECOS Enrollment status is PENDING. Requires final verification of Medicare billing eligibility.",
        timeline: "Estimated onboarding completion in 14 days, pending PECOS status update.",
      },
      sources: [
        { name: "Identity", status: "CHECKED" as const, details: "NPPES Registry match confirmed." },
        { name: "Sanctions", status: "CHECKED" as const, details: "OIG/LEIE Exclusion List: No matches found." },
        { name: "Licensure", status: "CHECKED" as const, details: "CA Medical Board: Active/Good Standing." },
        { name: "Enrollment", status: "PENDING" as const, details: "PECOS: Application submitted, awaiting approval." },
      ],
    },
    {
      clinicianName: "Dr. Sarah Chen, DO",
      npi: "1003000126",
      specialty: "Emergency Medicine",
      status: "Ready" as const,
      submissionDate: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
      timeToStart: "0 Days",
      synthesis: {
        verifiedCredentials: "All primary sources verified and active.",
        identifiedGaps: "None.",
        timeline: "Cleared to start immediately.",
      },
      sources: [
        { name: "Identity", status: "CHECKED" as const, details: "NPPES Registry match confirmed." },
        { name: "Sanctions", status: "CHECKED" as const, details: "OIG/LEIE clear." },
      ],
    },
    {
      clinicianName: "Dr. Emily Davis, MD",
      npi: "9876543210",
      specialty: "Cardiology",
      status: "Needs Review" as const,
      submissionDate: new Date(Date.now() - 86400000 * 10).toISOString(), // 10 days ago
      timeToStart: "TBD",
      synthesis: {
        verifiedCredentials: "NPPES Identity confirmed.",
        identifiedGaps: "State license expired. Requires manual intervention.",
        timeline: "Blocked until license renewal is verified.",
      },
      sources: [
        { name: "Licensure", status: "ACCESS REQUIRED" as const, details: "License expired on 2025-12-31." },
      ],
    }
  ];

  const handleRequestReview = (source: string) => {
    setManualReviews(prev => [...prev, source]);
  };

  const getTrustState = (data: NPIDataResponse): TrustState => {
    if (!data || !data.identity) {
      return {
        readinessScore: 0,
        estimatedStart: "TBD",
        identity: { source: "NPPES", state: "PENDING", details: "No data" },
        sanctions: { source: "OIG/LEIE", state: "PENDING", details: "No data" },
        licensure: { source: "FSMB", state: "PENDING", details: "No data" },
        enrollment: { source: "PECOS", state: "PENDING", details: "No data" },
        boardCertification: { source: "ABMS / NCCPA", state: "PENDING", details: "No data" },
        deaRegistration: { source: "DEA / State CSR", state: "PENDING", details: "No data" },
      };
    }
    const baseState = {
      readinessScore: data.readinessScore,
      estimatedStart: "14-28 days", // Mocked as requested or derived
      identity: { 
        source: "NPPES", 
        state: data.identity.status.toUpperCase(), 
        details: `NPI: ${data.npi} | Enumerated: ${data.identity.enumerationDate}` 
      },
      sanctions: { 
        source: "OIG/LEIE", 
        state: data.sanctions.status.toUpperCase(), 
        details: data.sanctions.exclusionStatus ? "Exclusion found" : "No exclusions found" 
      },
      licensure: { 
        source: "FSMB / State Board", 
        state: data.licensure.status.toUpperCase(), 
        details: `License: ${data.licensure.licenseNumber} (${data.licensure.state})` 
      },
      enrollment: { 
        source: "PECOS", 
        state: data.pecos.status.toUpperCase(), 
        details: data.pecos.enrolled ? "Medicare Enrolled" : "Enrollment Pending" 
      },
      boardCertification: {
        source: "ABMS / NCCPA",
        state: "CHECKED",
        details: "Board certification verified."
      },
      deaRegistration: {
        source: "DEA / State CSR",
        state: "ACCESS REQUIRED",
        details: "Requires institutional access to verify."
      }
    };

    if (manualReviews.includes("Identity")) {
      baseState.identity.state = "MANUAL REVIEW PENDING";
      baseState.identity.details = "Escalated to credentialing team for manual verification.";
    }
    if (manualReviews.includes("Sanctions")) {
      baseState.sanctions.state = "MANUAL REVIEW PENDING";
      baseState.sanctions.details = "Escalated to credentialing team for manual verification.";
    }
    if (manualReviews.includes("Licensure")) {
      baseState.licensure.state = "MANUAL REVIEW PENDING";
      baseState.licensure.details = "Escalated to credentialing team for manual verification.";
    }
    if (manualReviews.includes("Board Certification")) {
      baseState.boardCertification.state = "MANUAL REVIEW PENDING";
      baseState.boardCertification.details = "Escalated to credentialing team for manual verification.";
    }
    if (manualReviews.includes("DEA Registration")) {
      baseState.deaRegistration.state = "MANUAL REVIEW PENDING";
      baseState.deaRegistration.details = "Escalated to credentialing team for manual verification.";
    }
    if (manualReviews.includes("Enrollment")) {
      baseState.enrollment.state = "MANUAL REVIEW PENDING";
      baseState.enrollment.details = "Escalated to credentialing team for manual verification.";
    }

    return baseState;
  };

  const demoNpis = ["1234567890", "1003000126", "9876543210"];
  const allSuggestions = Array.from(new Set([...recentSearches, ...demoNpis]));
  const filteredSuggestions = allSuggestions.filter(s => s.includes(npi));

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-line p-6 flex justify-between items-center bg-[var(--color-bg)] sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-ink rounded-sm flex items-center justify-center text-bg font-bold">V</div>
          <h1 className="text-xl font-bold tracking-tighter uppercase">VitalCV</h1>
        </div>
        <nav className="hidden md:flex gap-8 text-xs font-medium uppercase tracking-widest opacity-60">
          <button 
            onClick={() => {
              setData(null);
              setAnalysis(null);
              setViewMode("clinician");
              setShowDemoEmployer(false);
              setShowReviewRequest(false);
            }} 
            className="hover:opacity-100 transition-opacity"
          >
            Start with NPI
          </button>
          <button 
            onClick={() => {
              setViewMode("employer");
              setShowReviewRequest(true);
              setCurrentOrgId("NEW-PILOT-ORG-" + Math.floor(Math.random() * 1000));
              setWorkspaceActive(false);
            }}
            className="hover:opacity-100 transition-opacity"
          >
            Review Request
          </button>
          <button 
            onClick={() => {
              setViewMode("cover-letter");
              setData(null);
              setAnalysis(null);
              setShowReviewRequest(false);
            }}
            className="hover:opacity-100 transition-opacity"
          >
            Cover Letter
          </button>
          <a href="/explore" className="hover:opacity-100 transition-opacity">Explore</a>
        </nav>
        <div className="flex items-center gap-4">
          {(viewMode === "employer" || showDemoEmployer || showReviewRequest) && (
            <EmployerNotifications orgId={currentOrgId} />
          )}
          <button 
            onClick={toggleTheme}
            className="p-2 hover:bg-ink/5 rounded-full transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button 
            onClick={() => {
              setData(null);
              setAnalysis(null);
              setViewMode("clinician");
              setShowDemoEmployer(false);
              setShowReviewRequest(false);
            }}
            className="text-xs font-bold uppercase tracking-widest bg-ink text-bg px-6 py-2 hover:opacity-90 transition-colors"
          >
            Enter NPI
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-12">
        <AnimatePresence mode="wait">
          {viewMode === "cover-letter" ? (
            <motion.div
              key="cover-letter"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full"
            >
              <CoverLetterGenerator onBack={() => setViewMode("clinician")} />
            </motion.div>
          ) : showReviewRequest ? (
            <motion.div
              key="review-request"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[60vh]"
            >
              {!workspaceActive ? (
                <EmployerWorkspaceBootstrap 
                  orgId={currentOrgId} 
                  onComplete={() => setWorkspaceActive(true)} 
                />
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full space-y-12"
                >
                  <div className="text-center space-y-4">
                    <h2 className="text-4xl font-bold tracking-tighter uppercase">Review Link Generated</h2>
                    <p className="text-sm opacity-60 font-mono">Workspace active for {currentOrgId}. Reviewing clinician packet...</p>
                  </div>
                  <EmployerReviewDashboard packets={mockEmployerPackets} />
                </motion.div>
              )}
            </motion.div>
          ) : !data ? (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center"
            >
              <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 max-w-2xl uppercase">
                Check clinician <span className="italic font-serif font-medium text-ink/80">readiness</span> in seconds.
              </h2>
              <p className="text-lg opacity-60 mb-12 max-w-xl">
                Source-backed truth for you and the employers you choose. Enter your NPI to start.
              </p>
              
              <form onSubmit={handleSearch} className="w-full max-w-md relative">
                <input
                  type="text"
                  value={npi}
                  onChange={(e) => {
                    setNpi(e.target.value.replace(/\D/g, "").slice(0, 10));
                  }}
                  placeholder="ENTER 10-DIGIT NPI"
                  className="w-full bg-transparent border-b-2 border-line py-4 px-2 text-2xl font-mono focus:outline-none focus:border-ink transition-colors placeholder:opacity-20 uppercase"
                />
                <button
                  type="submit"
                  disabled={loading || npi.length !== 10}
                  className="absolute right-0 bottom-4 p-2 disabled:opacity-20 hover:scale-110 transition-transform"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ArrowRight className="w-6 h-6" />
                  )}
                </button>
                
                {error && <p className="text-xs text-red-500 mt-2 text-left absolute -bottom-6">{error}</p>}
              </form>
              
              <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 opacity-40 grayscale">
                <div className="flex flex-col items-center gap-2">
                  <Shield className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">NPPES</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">OIG/LEIE</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">PECOS</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Activity className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">FSMB</span>
                </div>
              </div>

              {/* Interview Mode Teaser */}
              <ReadinessPreview 
                npi={npi} 
                onClick={() => {
                  const targetNpi = npi.length === 10 ? npi : "1003000126";
                  setNpi(targetNpi);
                  handleSearch(null, targetNpi);
                }} 
              />

              {/* Explore Section */}
              <div className="mt-32 w-full text-left border-t border-line pt-12">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] opacity-40 mb-8">One Record, Three Uses</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="border border-line p-6 hover:bg-white/5 transition-colors group">
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4 border border-line inline-block px-2 py-1">For Clinicians</div>
                    <h4 className="text-sm font-bold uppercase tracking-widest mb-2 group-hover:underline underline-offset-4">Own your credentials</h4>
                    <p className="text-[10px] opacity-60 font-mono leading-relaxed">
                      Generate your portable passport from federal sources. Share it once, and get hired in days instead of months.
                    </p>
                  </div>
                  <div 
                    onClick={() => {
                      setViewMode("employer");
                      setShowReviewRequest(true);
                      setCurrentOrgId("NEW-PILOT-ORG-" + Math.floor(Math.random() * 1000));
                      setWorkspaceActive(false);
                    }}
                    className="border border-line p-6 hover:bg-white/5 transition-colors group block cursor-pointer"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4 border border-line inline-block px-2 py-1">For Employers</div>
                    <h4 className="text-sm font-bold uppercase tracking-widest mb-2 group-hover:underline underline-offset-4">Make faster decisions</h4>
                    <p className="text-[10px] opacity-60 font-mono leading-relaxed">
                      Stop chasing missing documents. Review a source-backed decision posture and accept candidates immediately.
                    </p>
                  </div>
                  <div className="border border-line p-6 hover:bg-white/5 transition-colors group">
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4 border border-line inline-block px-2 py-1">For Ops & Partners</div>
                    <h4 className="text-sm font-bold uppercase tracking-widest mb-2 group-hover:underline underline-offset-4">Integrate the Truth Layer</h4>
                    <p className="text-[10px] opacity-60 font-mono leading-relaxed">
                      Embed readiness scores directly into your ATS or credentialing system via our developer API.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-12 pb-24"
            >
              {showDemoEmployer ? (
                <EmployerReviewDashboard packets={mockEmployerPackets} />
              ) : (
                <>
                  {/* Clinician Passport Component */}
                  <ClinicianPassport 
                    trustState={getTrustState(data)} 
                    npi={data?.npi || npi} 
                    clinicianName={data?.identity?.firstName ? `${data.identity.firstName} ${data.identity.lastName}` : undefined}
                    error={error}
                    onRetry={() => handleSearch(null)}
                  />

                  {/* AI Analysis */}
                  <LiveTrustConsole analyzing={analyzing} analysis={analysis} />

                  {/* Actions */}
                  <div className="flex flex-col md:flex-row gap-4">
                    {viewMode === "clinician" ? (
                      <button 
                        onClick={() => setShowDemoEmployer(true)}
                        className="flex-1 bg-ink text-bg py-4 font-bold uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center justify-center gap-2 group"
                      >
                        Preview Employer View <Eye className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ) : (
                      <button className="flex-1 bg-ink text-bg py-4 font-bold uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center justify-center gap-2 group">
                        Request Full Credentialing <FileText className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setData(null);
                        setAnalysis(null);
                      }}
                      className="px-8 border border-line py-4 font-bold uppercase tracking-widest hover:bg-ink hover:text-bg transition-colors"
                    >
                      New Search
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-line p-8 bg-[var(--color-bg)]/50">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">
            © 2026 VitalCV · Built for Healthcare Mobility
          </div>
          <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest opacity-40">
            <a href="/explore" className="hover:opacity-100 transition-opacity">Explore</a>
            <a href="/developers" className="hover:opacity-100 transition-opacity">Developers</a>
            <a href="/compliance" className="hover:opacity-100 transition-opacity">Compliance</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
