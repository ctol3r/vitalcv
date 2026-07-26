// Career OS — root app + hash router.
// Routes: #/career/:id (home) · #/memory/:id · #/reputation/:id · #/mobility/:id

const ENTITIES = { 'macie-miller': ENTITY };

function App() {
  const { surface, entityId } = useRoute();
  const entity = ENTITIES[entityId] || ENTITY;

  // normalize an empty hash to the dashboard
  React.useEffect(() => {
    if (!window.location.hash) window.location.replace('#/career/macie-miller');
  }, []);

  let View;
  if (surface === 'memory') View = ViewMemory;
  else if (surface === 'reputation') View = ViewReputation;
  else if (surface === 'mobility') View = ViewMobility;
  else View = ViewCareer;

  return (
    <div className="min-h-screen bg-slate-100">
      <TopChrome surface={surface} entityId={entityId} entity={entity} />
      <main key={surface} className="pb-16">
        <View entity={entity} />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-[1340px] mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3 mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
          <span>VitalCV · Career OS · Wave 240</span>
          <span className="hidden sm:inline">memory · reputation · mobility · one owned ledger</span>
          <span>vc.2026.06.21 · w240 · v1</span>
        </div>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
