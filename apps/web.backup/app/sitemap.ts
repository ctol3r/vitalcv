import { MetadataRoute } from 'next';

interface Job {
  id: string;
  updatedAt: string;
  status: string;
}

interface Organization {
  id: string;
  updatedAt: string;
  active: boolean;
}

async function getActiveJobs(): Promise<Job[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/jobs?status=active&limit=10000`, {
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      console.error('Failed to fetch jobs for sitemap');
      return [];
    }

    const data = await response.json();
    return data.jobs || [];
  } catch (error) {
    console.error('Error fetching jobs for sitemap:', error);
    return [];
  }
}

async function getActiveOrganizations(): Promise<Organization[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/organizations?active=true&limit=10000`, {
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      console.error('Failed to fetch organizations for sitemap');
      return [];
    }

    const data = await response.json();
    return data.organizations || [];
  } catch (error) {
    console.error('Error fetching organizations for sitemap:', error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://vitalcv.com';

  // Fetch dynamic data
  const [jobs, organizations] = await Promise.all([
    getActiveJobs(),
    getActiveOrganizations(),
  ]);

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/start`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/jobs`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/organizations`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/wallet`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/verify`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/issuer`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/developers`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/support`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  // Dynamic job pages
  const jobPages: MetadataRoute.Sitemap = jobs.map((job) => ({
    url: `${baseUrl}/jobs/${job.id}`,
    lastModified: new Date(job.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Dynamic organization landing pages
  const orgPages: MetadataRoute.Sitemap = organizations.map((org) => ({
    url: `${baseUrl}/org/${org.id}`,
    lastModified: new Date(org.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Exclude internal/admin pages
  // These patterns are explicitly excluded from the sitemap:
  // - /admin/*
  // - /dashboard/*
  // - /api/*
  // - /dev/*
  // - /analytics/* (internal only)
  // - /ops/*
  // - Any pages requiring authentication

  return [
    ...staticPages,
    ...jobPages,
    ...orgPages,
  ];
}

/**
 * Generate robots.txt dynamically
 * This ensures search engines respect our sitemap and crawling preferences
 */
export async function generateRobotsTxt(): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://vitalcv.com';
  const isProduction = process.env.NODE_ENV === 'production';

  return `
# VitalCV Robots.txt
User-agent: *
${isProduction ? 'Allow: /' : 'Disallow: /'}

# Allow public pages
Allow: /
Allow: /start
Allow: /jobs/*
Allow: /org/*
Allow: /verify
Allow: /developers
Allow: /support

# Disallow internal/admin pages
Disallow: /admin/
Disallow: /dashboard/
Disallow: /api/
Disallow: /dev/
Disallow: /analytics/
Disallow: /ops/
Disallow: /wallet/
Disallow: /issuer/
Disallow: /claim/
Disallow: /npi/*/edit

# Disallow search result pages (if implemented)
Disallow: /search?*
Disallow: /*?demo=*
Disallow: /*?auto=*

# Crawl-delay (be nice to servers)
Crawl-delay: 1

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml
`.trim();
}

