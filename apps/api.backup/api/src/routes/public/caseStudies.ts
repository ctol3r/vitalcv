/**
 * B143C-MKT-007: Public Case Study Stories API
 *
 * Returns structured JSON for case studies showcasing:
 * - Problem faced by customer
 * - Approach/solution implemented
 * - Results and metrics achieved
 *
 * Used by marketing website, sales materials, and public documentation.
 *
 * Routes:
 *   GET /public/case-studies              - List all published case studies
 *   GET /public/case-studies/:id          - Get specific case study
 *   GET /public/case-studies/:id/embed    - Get embeddable widget HTML
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

export interface CaseStudy {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  organization: {
    name: string;
    type: string; // 'health_system', 'staffing_agency', 'telehealth', 'clinic'
    size: string; // '1-50', '51-200', '201-1000', '1000+'
    location?: {
      city?: string;
      state?: string;
      country: string;
    };
    logo?: string;
    website?: string;
  };
  publishedAt: string;
  lastUpdated?: string;
  featured: boolean;
  tags: string[]; // e.g., ['credentialing', 'time-to-hire', 'cost-savings']
  problem: {
    summary: string;
    details: string[];
    painPoints: string[];
    impact: string;
  };
  approach: {
    summary: string;
    implementation: {
      phase: string;
      duration: string;
      activities: string[];
    }[];
    technologies: string[];
    integrations?: string[];
  };
  results: {
    summary: string;
    metrics: {
      name: string;
      before: string | number;
      after: string | number;
      improvement: string;
      unit?: string;
    }[];
    outcomes: string[];
    roi?: {
      investment: number;
      savings: number;
      paybackMonths: number;
    };
  };
  testimonial?: {
    quote: string;
    author: string;
    title: string;
    photo?: string;
  };
  media?: {
    hero?: string;
    images?: string[];
    video?: string;
  };
  relatedResources?: {
    title: string;
    type: 'whitepaper' | 'blog' | 'video' | 'demo';
    url: string;
  }[];
}

// Sample case studies data
const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'cs-001',
    slug: 'metro-health-credentialing',
    title: 'Metro Regional Health Cuts Credentialing Time by 92%',
    subtitle: 'How blockchain-verified credentials transformed healthcare hiring',
    organization: {
      name: 'Metro Regional Health System',
      type: 'health_system',
      size: '201-1000',
      location: {
        city: 'Springfield',
        state: 'IL',
        country: 'USA',
      },
      logo: 'https://vitalcv.com/logos/metro-health.png',
      website: 'https://metrohealth.example.com',
    },
    publishedAt: '2025-11-01T00:00:00Z',
    lastUpdated: '2025-11-10T00:00:00Z',
    featured: true,
    tags: ['credentialing', 'time-to-hire', 'cost-savings', 'blockchain'],
    problem: {
      summary: 'Metro Regional Health faced 90+ day credentialing delays causing high vacancy costs and staff burnout.',
      details: [
        'Manual credentialing process took 90-120 days per clinician',
        'High cost of vacancy ($10,000+ per day for specialists)',
        'Manual verification errors led to compliance risk',
        'Candidate drop-off due to slow hiring process',
        'Credentialing staff overwhelmed with repetitive verification tasks',
      ],
      painPoints: [
        'Unable to fill urgent positions quickly',
        'Lost qualified candidates to competitors',
        'Compliance risk from expired licenses',
        'Staff burnout from manual workload',
      ],
      impact: 'Estimated annual cost of $1.8M in vacancy costs and credentialing overhead',
    },
    approach: {
      summary: 'Implemented VitalCV platform with blockchain-backed credential verification for family medicine and emergency department hiring.',
      implementation: [
        {
          phase: 'Integration',
          duration: '2 weeks',
          activities: [
            'Connected VitalCV widget to existing ATS',
            'Configured FHIR endpoints for EHR integration',
            'Set up job posting templates with credential requirements',
            'Trained hiring managers and credentialing staff',
          ],
        },
        {
          phase: 'Pilot',
          duration: '4 weeks',
          activities: [
            'Posted 5 family medicine positions',
            'Onboarded 15 clinicians with verified credentials',
            'Completed first hires in under 10 days',
            'Gathered feedback and optimized workflow',
          ],
        },
        {
          phase: 'Scale',
          duration: 'Ongoing',
          activities: [
            'Expanded to all clinical departments',
            'Automated license monitoring and renewal alerts',
            'Integrated with NPDB and PECOS for ongoing verification',
          ],
        },
      ],
      technologies: [
        'W3C Verifiable Credentials',
        'Blockchain anchoring (Ethereum)',
        'FHIR R4 integration',
        'Zero-knowledge proofs for privacy',
      ],
      integrations: [
        'Greenhouse ATS',
        'Epic EHR',
        'NPDB continuous monitoring',
        'PECOS enrollment verification',
      ],
    },
    results: {
      summary: 'Reduced credentialing time from 90 days to 7 days, saving $1.2M annually with zero compliance incidents.',
      metrics: [
        {
          name: 'Time to Fill',
          before: 90,
          after: 7,
          improvement: '92% faster',
          unit: 'days',
        },
        {
          name: 'Cost per Hire',
          before: 2000,
          after: 499,
          improvement: '$1,501 savings',
          unit: 'USD',
        },
        {
          name: 'Application Completion Rate',
          before: 45,
          after: 82,
          improvement: '82% increase',
          unit: '%',
        },
        {
          name: 'Credentialing Staff Time',
          before: 40,
          after: 5,
          improvement: '87.5% reduction',
          unit: 'hours/hire',
        },
        {
          name: 'Compliance Incidents',
          before: 3,
          after: 0,
          improvement: '100% reduction',
          unit: 'per year',
        },
      ],
      outcomes: [
        'Filled 30 critical positions in first 3 months',
        'Eliminated manual license verification backlog',
        'Zero compliance violations since implementation',
        'Improved candidate satisfaction (95% rating)',
        'Freed up credentialing staff for strategic initiatives',
      ],
      roi: {
        investment: 15000,
        savings: 1200000,
        paybackMonths: 0.15,
      },
    },
    testimonial: {
      quote: 'VitalCV transformed our hiring process. We went from months to days, and our candidates love the seamless experience. The blockchain-backed verification gives us complete confidence in credential authenticity.',
      author: 'Dr. Sarah Martinez',
      title: 'Chief Medical Officer',
      photo: 'https://vitalcv.com/testimonials/sarah-martinez.jpg',
    },
    media: {
      hero: 'https://vitalcv.com/case-studies/metro-health-hero.jpg',
      images: [
        'https://vitalcv.com/case-studies/metro-health-dashboard.jpg',
        'https://vitalcv.com/case-studies/metro-health-team.jpg',
      ],
      video: 'https://youtube.com/watch?v=example',
    },
    relatedResources: [
      {
        title: 'Healthcare Credentialing Whitepaper',
        type: 'whitepaper',
        url: 'https://vitalcv.com/whitepapers/credentialing',
      },
      {
        title: 'How Blockchain Transforms Healthcare Hiring',
        type: 'blog',
        url: 'https://vitalcv.com/blog/blockchain-healthcare-hiring',
      },
    ],
  },
  {
    id: 'cs-002',
    slug: 'telehealth-connect-multi-state',
    title: 'TeleHealth Connect Scales to 20 States with Automated License Verification',
    subtitle: 'PSYPACT and IMLC compact verification enables rapid multi-state expansion',
    organization: {
      name: 'TeleHealth Connect',
      type: 'telehealth',
      size: '51-200',
      location: {
        city: 'Remote',
        state: 'CA',
        country: 'USA',
      },
      logo: 'https://vitalcv.com/logos/telehealth-connect.png',
      website: 'https://telehealthconnect.example.com',
    },
    publishedAt: '2025-11-05T00:00:00Z',
    featured: true,
    tags: ['telehealth', 'multi-state', 'compact', 'psypact', 'imlc'],
    problem: {
      summary: 'Manual multi-state license tracking and compact eligibility verification was error-prone and hindering expansion.',
      details: [
        'Tracking licenses across 20+ states was manual and time-consuming',
        'PSYPACT and IMLC eligibility determination took 3-5 days per clinician',
        'Compliance risk from expired licenses or invalid compact assumptions',
        'Unable to quickly respond to demand spikes in new states',
      ],
      painPoints: [
        'Slow expansion to new markets',
        'Compliance violations and penalties',
        'Lost revenue from delayed launches',
        'Manual spreadsheet tracking prone to errors',
      ],
      impact: 'Expansion to new states took 60+ days due to manual verification',
    },
    approach: {
      summary: 'Implemented VitalCV compact verification and license monitoring for automated PSYPACT and IMLC eligibility.',
      implementation: [
        {
          phase: 'Setup',
          duration: '1 week',
          activities: [
            'Imported existing clinician roster',
            'Configured compact rules for PSYPACT and IMLC',
            'Set up automated license monitoring',
            'Integrated with state board APIs',
          ],
        },
        {
          phase: 'Validation',
          duration: '2 weeks',
          activities: [
            'Validated compact eligibility for all clinicians',
            'Identified 12 clinicians with eligibility issues',
            'Corrected license data and re-verified',
            'Established monitoring alerts for expirations',
          ],
        },
      ],
      technologies: [
        'PSYPACT E.Passport verification',
        'IMLC home state validation',
        'State board API integration',
        'Automated license monitoring',
      ],
      integrations: [
        'PSYPACT registry',
        'IMLC database',
        'State medical boards (50 states)',
        'Internal scheduling system',
      ],
    },
    results: {
      summary: 'Instant license verification enabled 300% faster expansion with zero compliance incidents.',
      metrics: [
        {
          name: 'License Verification Time',
          before: '3-5 days',
          after: 'Instant',
          improvement: '100% faster',
        },
        {
          name: 'Expansion Speed',
          before: 60,
          after: 7,
          improvement: '88% faster',
          unit: 'days',
        },
        {
          name: 'Compliance Incidents',
          before: 4,
          after: 0,
          improvement: '100% reduction',
          unit: 'per year',
        },
        {
          name: 'Manual Verification Hours',
          before: 120,
          after: 0,
          improvement: '100% reduction',
          unit: 'hours/month',
        },
      ],
      outcomes: [
        'Expanded to 20 states in 6 months (previously 3-4 states/year)',
        'Zero licensing violations since implementation',
        'Real-time alerts for license expirations (30, 60, 90 days)',
        'Automated PSYPACT and IMLC eligibility checks',
        'Confidence to bid on multi-state contracts',
      ],
      roi: {
        investment: 12000,
        savings: 480000,
        paybackMonths: 0.3,
      },
    },
    testimonial: {
      quote: 'The automated compact verification alone is worth it. We can confidently scale across states without compliance risk. VitalCV turned a major bottleneck into a competitive advantage.',
      author: 'Michael Chen',
      title: 'VP of Operations',
      photo: 'https://vitalcv.com/testimonials/michael-chen.jpg',
    },
    media: {
      hero: 'https://vitalcv.com/case-studies/telehealth-connect-hero.jpg',
    },
    relatedResources: [
      {
        title: 'Multi-State Telehealth Licensing Guide',
        type: 'whitepaper',
        url: 'https://vitalcv.com/whitepapers/multi-state-licensing',
      },
    ],
  },
  {
    id: 'cs-003',
    slug: 'staffpro-agency-candidate-experience',
    title: 'StaffPro Agency Increases Placement Rate by 65% with Seamless Credentialing',
    subtitle: 'Travel nurses complete applications 3x faster with verified credentials',
    organization: {
      name: 'StaffPro Staffing Agency',
      type: 'staffing_agency',
      size: '51-200',
      location: {
        city: 'Dallas',
        state: 'TX',
        country: 'USA',
      },
      logo: 'https://vitalcv.com/logos/staffpro.png',
    },
    publishedAt: '2025-11-08T00:00:00Z',
    featured: false,
    tags: ['staffing', 'candidate-experience', 'travel-nursing', 'application-rate'],
    problem: {
      summary: 'High candidate drop-off due to repetitive credentialing requirements for each client.',
      details: [
        'Candidates required to submit same credentials for each assignment',
        '55% drop-off rate during application process',
        'Lost placements due to slow credentialing',
        'Frustrated candidates switching to competitors',
      ],
      painPoints: [
        'Declining placement rates',
        'Candidate complaints about process',
        'Administrative burden on recruiters',
        'Lost revenue from unfilled assignments',
      ],
      impact: 'Estimated $800K annual revenue loss from unfilled placements',
    },
    approach: {
      summary: 'Implemented VitalCV one-click application with portable verified credentials.',
      implementation: [
        {
          phase: 'Rollout',
          duration: '3 weeks',
          activities: [
            'Integrated VitalCV widget into job board',
            'Migrated existing candidate credentials',
            'Launched marketing campaign to candidates',
            'Trained recruiters on new workflow',
          ],
        },
      ],
      technologies: [
        'W3C Verifiable Credentials',
        'One-click application widget',
        'Portable credential wallet',
      ],
      integrations: ['Bullhorn ATS', 'Candidate portal'],
    },
    results: {
      summary: 'Application completion rate increased from 45% to 88%, resulting in 65% more placements.',
      metrics: [
        {
          name: 'Application Completion Rate',
          before: 45,
          after: 88,
          improvement: '96% increase',
          unit: '%',
        },
        {
          name: 'Time to Apply',
          before: 25,
          after: 3,
          improvement: '88% faster',
          unit: 'minutes',
        },
        {
          name: 'Placement Rate',
          before: 35,
          after: 58,
          improvement: '65% increase',
          unit: '%',
        },
        {
          name: 'Candidate Satisfaction',
          before: 68,
          after: 94,
          improvement: '38% increase',
          unit: '%',
        },
      ],
      outcomes: [
        'Increased monthly placements from 120 to 200',
        'Reduced recruiter administrative burden by 60%',
        'Improved candidate NPS score from +32 to +75',
        'Competitive advantage in candidate acquisition',
      ],
      roi: {
        investment: 10000,
        savings: 720000,
        paybackMonths: 0.17,
      },
    },
    testimonial: {
      quote: 'Our travel nurses love the one-click application. They credential once and apply to multiple assignments without repeating paperwork. It's a game-changer for candidate experience.',
      author: 'Jennifer Lopez',
      title: 'VP of Recruitment',
    },
    media: {
      hero: 'https://vitalcv.com/case-studies/staffpro-hero.jpg',
    },
  },
];

/**
 * GET /public/case-studies
 * List all published case studies
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      featured,
      tag,
      organizationType,
      limit = 10,
      offset = 0,
    } = req.query;

    let filteredStudies = [...CASE_STUDIES];

    // Filter by featured
    if (featured === 'true') {
      filteredStudies = filteredStudies.filter(cs => cs.featured);
    }

    // Filter by tag
    if (tag) {
      filteredStudies = filteredStudies.filter(cs =>
        cs.tags.includes(tag as string)
      );
    }

    // Filter by organization type
    if (organizationType) {
      filteredStudies = filteredStudies.filter(cs =>
        cs.organization.type === organizationType
      );
    }

    // Sort by publish date (newest first)
    filteredStudies.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    // Pagination
    const total = filteredStudies.length;
    const paginatedStudies = filteredStudies.slice(
      Number(offset),
      Number(offset) + Number(limit)
    );

    res.json({
      total,
      limit: Number(limit),
      offset: Number(offset),
      caseStudies: paginatedStudies.map(cs => ({
        id: cs.id,
        slug: cs.slug,
        title: cs.title,
        subtitle: cs.subtitle,
        organization: cs.organization,
        publishedAt: cs.publishedAt,
        featured: cs.featured,
        tags: cs.tags,
        summary: cs.results.summary,
        media: cs.media,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching case studies:', error);
    res.status(500).json({
      error: 'Failed to fetch case studies',
      message: error.message,
    });
  }
});

/**
 * GET /public/case-studies/:id
 * Get specific case study by ID or slug
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const caseStudy = CASE_STUDIES.find(
      cs => cs.id === id || cs.slug === id
    );

    if (!caseStudy) {
      return res.status(404).json({
        error: 'Case study not found',
        message: `No case study found with ID or slug: ${id}`,
      });
    }

    res.json(caseStudy);
  } catch (error: any) {
    console.error('Error fetching case study:', error);
    res.status(500).json({
      error: 'Failed to fetch case study',
      message: error.message,
    });
  }
});

/**
 * GET /public/case-studies/:id/embed
 * Get embeddable widget HTML for case study
 */
router.get('/:id/embed', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { theme = 'light' } = req.query;

    const caseStudy = CASE_STUDIES.find(
      cs => cs.id === id || cs.slug === id
    );

    if (!caseStudy) {
      return res.status(404).json({
        error: 'Case study not found',
      });
    }

    // Generate embeddable HTML widget
    const embedHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; }
    .case-study-widget { max-width: 800px; margin: 0 auto; }
    .header { border-bottom: 2px solid #3498db; padding-bottom: 15px; margin-bottom: 20px; }
    .title { font-size: 24px; font-weight: bold; margin: 0 0 10px 0; }
    .organization { color: #666; font-size: 16px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .metric-card { padding: 15px; background: #f8f9fa; border-radius: 8px; }
    .metric-name { font-size: 14px; color: #666; margin-bottom: 5px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #2c3e50; }
    .metric-improvement { font-size: 12px; color: #27ae60; margin-top: 5px; }
    .testimonial { background: #f8f9fa; padding: 20px; border-left: 4px solid #3498db; margin: 20px 0; font-style: italic; }
    .author { font-style: normal; font-weight: bold; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="case-study-widget">
    <div class="header">
      <h1 class="title">${caseStudy.title}</h1>
      <p class="organization">${caseStudy.organization.name}</p>
    </div>

    <p><strong>Results:</strong> ${caseStudy.results.summary}</p>

    <div class="metrics">
      ${caseStudy.results.metrics.slice(0, 3).map(metric => `
        <div class="metric-card">
          <div class="metric-name">${metric.name}</div>
          <div class="metric-value">${metric.after}${metric.unit || ''}</div>
          <div class="metric-improvement">${metric.improvement}</div>
        </div>
      `).join('')}
    </div>

    ${caseStudy.testimonial ? `
      <div class="testimonial">
        "${caseStudy.testimonial.quote}"
        <div class="author">— ${caseStudy.testimonial.author}, ${caseStudy.testimonial.title}</div>
      </div>
    ` : ''}

    <p><a href="https://vitalcv.com/case-studies/${caseStudy.slug}" target="_blank">Read full case study →</a></p>
  </div>
</body>
</html>
    `.trim();

    res.setHeader('Content-Type', 'text/html');
    res.send(embedHTML);
  } catch (error: any) {
    console.error('Error generating embed:', error);
    res.status(500).send('Failed to generate embed');
  }
});

/**
 * GET /public/case-studies/tags
 * Get all available tags
 */
router.get('/meta/tags', async (req: Request, res: Response) => {
  try {
    const allTags = new Set<string>();
    CASE_STUDIES.forEach(cs => {
      cs.tags.forEach(tag => allTags.add(tag));
    });

    res.json({
      tags: Array.from(allTags).sort(),
    });
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    res.status(500).json({
      error: 'Failed to fetch tags',
      message: error.message,
    });
  }
});

export default router;
export { CaseStudy, CASE_STUDIES };

