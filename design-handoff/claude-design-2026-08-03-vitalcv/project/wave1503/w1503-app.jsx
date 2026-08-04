// Wave 1503 · w1503-app.jsx — funnel router mount.

const FUNNEL_TITLES = {
  getready: 'VitalCV — Get ready',
  onboarding: 'VitalCV — Onboarding',
  passport: 'VitalCV — Passport',
  share: 'VitalCV — Shared proof packet',
};

const FunnelApp = () => {
  const route = useRoute3();
  React.useEffect(() => { document.title = FUNNEL_TITLES[route.name] || 'VitalCV'; }, [route.name]);
  return (
    <React.Fragment>
      <S3Nav route={route} />
      {route.name === 'onboarding' ? <OnboardingView key="ob" />
        : route.name === 'passport' ? <PassportView key="ps" />
        : route.name === 'share' ? <ShareView key={'sh-' + route.slug} />
        : <GetReadyView key="gr" />}
    </React.Fragment>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<FunnelApp />);
