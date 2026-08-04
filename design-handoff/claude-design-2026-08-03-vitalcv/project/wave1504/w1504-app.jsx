// Wave 1504 · w1504-app.jsx — router shell.
const S4App = () => {
  const route = useRoute4();
  const Page = {
    trust: TrustPage,
    attribution: AttributionPage,
    status: StatusPage,
    graph: GraphPage,
    brand: BrandPage,
  }[route.name] || TrustPage;
  return (
    <React.Fragment>
      <S4Nav route={route} />
      <main className="s4-main s4-fade" key={route.name}>
        <Page route={route} />
      </main>
      <S4Footer />
    </React.Fragment>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<S4App />);
