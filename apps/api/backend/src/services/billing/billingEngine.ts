import prisma from '../../graphql/prisma_client';

export async function processApplicationBilling(applicationId: string, isPilot: boolean) {
  const price = isPilot ? 0 : 100;
  
  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { price }
  });

  return updated;
}

export async function getRevenueMetrics() {
  const apps = await prisma.application.findMany({
    where: { price: { not: null } }
  });

  const hires = await prisma.application.findMany({
    where: { status: 'STARTED', price: { not: null } }
  });

  const totalRevenue = apps.reduce((sum, app) => sum + (app.price || 0), 0);
  const hireRevenue = hires.reduce((sum, app) => sum + (app.price || 0), 0);

  return {
    revenue_per_application: apps.length > 0 ? totalRevenue / apps.length : 0,
    revenue_per_hire: hires.length > 0 ? totalRevenue / hires.length : 0, // Total revenue divided by number of hires
    total_revenue: totalRevenue
  };
}
