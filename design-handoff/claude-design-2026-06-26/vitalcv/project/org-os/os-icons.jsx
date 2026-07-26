// Minimal inline SVG icons — stroke-based, matches Lucide visual language.
const ic = (paths, viewBox = '0 0 24 24') => ({ size = 16, className = '', strokeWidth = 1.75, ...rest }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox={viewBox}
       fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
       className={className} aria-hidden="true" {...rest}>
    {paths}
  </svg>
);

const Icon = {
  Check:      ic(<polyline points="20 6 9 17 4 12" />),
  CheckCircle: ic(<>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </>),
  Clock:      ic(<><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>),
  Lock:       ic(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  Shield:     ic(<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" />),
  ShieldCheck: ic(<><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" /><polyline points="9 12 11 14 15 10" /></>),
  AlertTri:   ic(<><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>),
  X:          ic(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>),
  ArrowRight: ic(<><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>),
  ArrowUp:    ic(<><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></>),
  ArrowDown:  ic(<><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></>),
  Download:   ic(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>),
  Refresh:    ic(<><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>),
  ChevronDown: ic(<polyline points="6 9 12 15 18 9" />),
  ChevronRight: ic(<polyline points="9 18 15 12 9 6" />),
  Copy:       ic(<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>),
  Link:       ic(<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>),
  ExternalLink: ic(<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></>),
  Search:     ic(<><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>),
  User:       ic(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  Building:   ic(<><rect x="3" y="3" width="18" height="18" rx="1" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></>),
  Badge:      ic(<><path d="M12 2 4 6v6c0 5.55 3.84 9.74 8 11 4.16-1.26 8-5.45 8-11V6l-8-4z" /></>),
  Fingerprint: ic(<><path d="M2 12a10 10 0 0 1 18-6" /><path d="M2 16a10 10 0 0 0 18 4" /><path d="M7 19.66a7 7 0 0 1-.7-3.66" /><path d="M6.3 10.3a7 7 0 0 1 11.4 0" /><path d="M10 20.6a15 15 0 0 1-.9-5.6" /><path d="M12 10a4 4 0 0 0-4 4" /><path d="M14 20.4a20 20 0 0 1-1.6-7.4" /><path d="M17 17a20 20 0 0 0-3-11" /></>),
  FileText:   ic(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></>),
  Activity:   ic(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />),
  Info:       ic(<><circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="12" y1="8" x2="12.01" y2="8" /></>),
  Stamp:      ic(<><path d="M5 22h14" /><path d="M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V17h16v-1.5c0-.47-.13-.92-.37-1.27z" /><path d="M14 13V8.5a2.5 2.5 0 0 0-5 0V13" /></>),
  Hash:       ic(<><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></>),
  Dot:        ic(<circle cx="12" cy="12" r="3.5" />),
  Minus:      ic(<line x1="5" y1="12" x2="19" y2="12" />),
  MapPin:     ic(<><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" /></>),
  Calendar:   ic(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>),
  ShieldLock: ic(<><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" /><rect x="9" y="11" width="6" height="5" rx="1" /><path d="M10.5 11V9.5a1.5 1.5 0 0 1 3 0V11" /></>),
  Globe:      ic(<><circle cx="12" cy="12" r="9" /><line x1="3" y1="12" x2="21" y2="12" /><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" /></>),
  Layers:     ic(<><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>),
  Gauge:      ic(<><path d="M12 14 7 9" /><path d="M3.69 16.5a9 9 0 1 1 16.62 0" /></>),
  GitBranch:  ic(<><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></>),
  Network:    ic(<><rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M5 16v-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/><path d="M12 8v4"/></>),
  Sparkles:   ic(<><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></>),
  Route:      ic(<><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19h6.5a4 4 0 0 0 4-4v-2a4 4 0 0 1 4-4h-6.5" transform="translate(-4 0)"/></>),
  Sun:        ic(<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>),
  Moon:       ic(<><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>),
  Printer:    ic(<><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>),
  Stethoscope: ic(<><path d="M4 3v6a4 4 0 0 0 8 0V3"/><path d="M4 3h2M10 3h2"/><path d="M8 13v3a4 4 0 0 0 8 0v-1"/><circle cx="18" cy="13" r="2.5"/></>),
  CreditCard: ic(<><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></>),
  ClipboardCheck: ic(<><rect x="6" y="4" width="12" height="18" rx="2"/><path d="M9 4V3a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1"/><polyline points="9 14 11 16 15 12"/></>),
  Book:        ic(<><path d="M4 4v16a2 2 0 0 0 2 2h14V2H6a2 2 0 0 0-2 2z"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="14" y2="10"/></>),
  Camera:      ic(<><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>),
  Code:        ic(<><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>),
  Users:       ic(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
  TrendUp:     ic(<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>),
  TrendDown:   ic(<><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></>),
  Filter:      ic(<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>),
  Bell:        ic(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>),
  Grid:        ic(<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>),
  BarChart:    ic(<><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></>),
  Briefcase:   ic(<><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>),
  Heart:       ic(<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>),
  PieChart:    ic(<><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></>),
  ChevronLeft: ic(<polyline points="15 18 9 12 15 6"/>),
  Plus:        ic(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>),
  MoreH:       ic(<><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>),
  Zap:         ic(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>),
};

window.Icon = Icon;
