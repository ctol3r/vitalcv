// WAVE 1300 — root app + hash router · Healthcare Workforce Operating System

const VIEW_FOR = {
  workspace:  ViewWorkspace,
  workflows:  ViewWorkflows,
  roles:      ViewRoles,
  dashboards: ViewDashboards,
  automation: ViewAutomation,
};

function App() {
  const { surface } = useRoute();
  const { accent, def } = useWorkspace();
  useAccentTheme(accent);
  React.useEffect(() => { if (!window.location.hash) window.location.replace('#/workspace'); }, []);
  const View = VIEW_FOR[surface] || ViewWorkspace;
  return (
    <div className="min-h-screen" style={{ background: '#0b0e13' }}>
      <TopChrome surface={surface} />
      <main className="pb-16">
        <View />
      </main>
      <footer className="border-t border-white/[0.07]">
        <div className="max-w-[1520px] mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3 mono text-[10px] uppercase tracking-[0.12em] text-slate-600">
          <span>VitalCV · Workforce OS · Wave 1300</span>
          <span className="hidden md:inline">{def.name}</span>
          <span>vc.2026.06.27 · w1300 · v1</span>
        </div>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
