// Wave 1501 · hp-app.jsx — homepage assembly (DG-7.12 section rhythm).

const HomePage = () => (
  <React.Fragment>
    <HpNav />
    <main>
      <HeroSection />
      <HowSection />
      <WhySection />
      <MatchaSection />
      <SkySection />
      <DoorsSection />
      <WhoSection />
    </main>
    <HpFooter />
  </React.Fragment>
);

ReactDOM.createRoot(document.getElementById('root')).render(<HomePage />);
