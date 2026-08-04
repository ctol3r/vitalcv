// Wave 1502 · w1502-app.jsx — mount + route switch.

const S2_TITLES = {
  pilot: 'VitalCV — Employer Pilot',
  request: 'VitalCV — Request a Review',
  entity: 'VitalCV — Reviewer Surface',
};

const App = () => {
  const route = useRoute();
  React.useEffect(() => { document.title = S2_TITLES[route.name] || 'VitalCV'; }, [route]);
  return (
    <React.Fragment>
      <S2Nav route={route} />
      {route.name === 'request' ? <RequestPage />
        : route.name === 'entity' ? <EntityPage id={route.id} />
        : <PilotPage />}
      <BoundaryFooter tight={route.name === 'entity'} />
    </React.Fragment>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
