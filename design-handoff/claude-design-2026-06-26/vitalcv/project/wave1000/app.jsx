// Career Platform — root app + hash router (Wave 1000)
// Routes: #/career · #/profile · #/command · #/opportunities · #/memory · #/legacy

const ENTITIES = { 'macie-miller': ENTITY };

const VIEW_FOR = {
  career: ViewHome,
  profile: ViewProfile,
  command: ViewCommand,
  opportunities: ViewOpportunities,
  memory: ViewMemory,
  legacy: ViewLegacy,
};

function App() {
  const { surface, entityId } = useRoute();
  const entity = ENTITIES[entityId] || ENTITY;

  React.useEffect(() => {
    if (!window.location.hash) window.location.replace('#/career/macie-miller');
  }, []);

  const View = VIEW_FOR[surface] || ViewHome;

  return (
    <div className="min-h-screen bg-slate-100">
      <TopChrome surface={surface} entityId={entityId} entity={entity} />
      <main key={surface} className="pb-16">
        <View entity={entity} />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-[1340px] mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3 mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
          <span>VitalCV · Career Platform · Wave 1000</span>
          <span className="hidden sm:inline">home · profile · command · opportunities · memory · legacy</span>
          <span>vc.2026.06.27 · w1000 · v1</span>
        </div>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
