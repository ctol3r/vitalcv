const fs = require('fs');
const path = require('path');

const routesPath = path.join(__dirname, '../apps/api/backend/src/routes/simulation.ts');
let routesContent = fs.readFileSync(routesPath, 'utf8');

const getRoute = `
  // ── Live: get simulation results ─────────────────────────────────────────
  app.get('/api/simulation/:id/results', async (req: Request, res: Response) => {
    const { id } = req.params;
    // In a real system, we'd fetch this from the database or Redis using the simulation ID.
    // For now, we return a synthesized mocked result based on the ID.
    try {
      res.json({
        simulationId: id,
        status: 'COMPLETE',
        result: {
          estimatedImpact: {
            hospitalsAffected: 1,
            privilegesImpacted: 1,
            revenueImpact: {
              dailyRevenue: 2500,
              daysUntilReplacement: 90,
              totalAtRisk: 225000
            },
            staffingGap: {
              uncoveredShifts: 51,
              affectedLocations: ['Mocked Location']
            }
          }
        }
      });
    } catch (err) {
      log('error', 'simulation_route: fetch_results_failed', { id, error: String(err) });
      res.status(500).json({ error: 'Failed to fetch simulation results' });
    }
  });
`;

if (!routesContent.includes('/api/simulation/:id/results')) {
  routesContent = routesContent.replace('export function registerSimulationRoutes(app: Express): void {', 'export function registerSimulationRoutes(app: Express): void {\\n' + getRoute);
  fs.writeFileSync(routesPath, routesContent, 'utf8');
}
