export default function Monitoring() {
  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Monitoring</h1>
      <p className='text-sm opacity-80'>
        Import <code>deploy/monitoring/grafana-dashboard.json</code> into Grafana;
        load alert rules from <code>deploy/monitoring/alerts.yaml</code> into Prometheus Alertmanager.
      </p>
    </div>
  );
}

