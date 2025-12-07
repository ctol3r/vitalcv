import { Metadata } from 'next';

interface JobPosting {
  id: string;
  title: string;
  description: string;
  specialty: string;
  location: {
    city?: string;
    state: string;
  };
  modality: 'in-person' | 'telehealth' | 'hybrid';
  compRangeMin?: number;
  compRangeMax?: number;
  partnerId: string;
  partnerName?: string;
  createdAt: string;
}

async function getJob(jobId: string): Promise<JobPosting | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/jobs/${jobId}`, {
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Failed to fetch job for metadata:', error);
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: { jobId: string } }
): Promise<Metadata> {
  const job = await getJob(params.jobId);

  if (!job) {
    return {
      title: 'Job Not Found | VitalCV',
      description: 'The requested job posting could not be found.',
    };
  }

  const jobTitle = `${job.title} at ${job.partnerName || 'Healthcare Organization'}`;
  const location = job.location.city
    ? `${job.location.city}, ${job.location.state}`
    : job.location.state;

  // Strip HTML from description for meta description
  const plainDescription = job.description.replace(/<[^>]*>/g, '').substring(0, 160);

  const salaryRange = job.compRangeMin && job.compRangeMax
    ? `$${job.compRangeMin.toLocaleString()} - $${job.compRangeMax.toLocaleString()}`
    : 'Competitive salary';

  const fullDescription = `${job.specialty} position in ${location}. ${plainDescription}...`;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://vitalcv.com';
  const imageUrl = `${baseUrl}/og/jobs/${params.jobId}.png`; // Dynamic OG image endpoint

  return {
    title: jobTitle,
    description: fullDescription,

    // OpenGraph tags
    openGraph: {
      type: 'website',
      url: `${baseUrl}/jobs/${params.jobId}`,
      title: jobTitle,
      description: fullDescription,
      siteName: 'VitalCV',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: jobTitle,
        },
      ],
    },

    // Twitter Card tags
    twitter: {
      card: 'summary_large_image',
      site: '@VitalCV',
      title: jobTitle,
      description: fullDescription,
      images: [imageUrl],
    },

    // Additional meta tags
    alternates: {
      canonical: `${baseUrl}/jobs/${params.jobId}`,
    },

    // Structured data for search engines
    other: {
      'job-posting-id': params.jobId,
      'job-specialty': job.specialty,
      'job-location': location,
      'job-modality': job.modality,
      'job-org': job.partnerName || '',
      'published-time': job.createdAt,
    },
  };
}

// JSON-LD Structured Data for JobPosting schema
export async function generateJsonLd(jobId: string) {
  const job = await getJob(jobId);

  if (!job) {
    return null;
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://vitalcv.com';

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description.replace(/<[^>]*>/g, ''),
    identifier: {
      '@type': 'PropertyValue',
      name: 'VitalCV Job ID',
      value: job.id,
    },
    datePosted: job.createdAt,
    validThrough: new Date(new Date(job.createdAt).getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
    employmentType: job.modality === 'telehealth' ? 'FULL_TIME' : 'OTHER',
    hiringOrganization: {
      '@type': 'Organization',
      name: job.partnerName || 'Healthcare Organization',
      sameAs: `${baseUrl}/org/${job.partnerId}`,
    },
    jobLocation: job.modality === 'telehealth' ? {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressRegion: 'US',
        addressCountry: 'US',
      },
      additionalType: 'Virtual Location',
    } : {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.location.city,
        addressRegion: job.location.state,
        addressCountry: 'US',
      },
    },
    baseSalary: job.compRangeMin && job.compRangeMax ? {
      '@type': 'MonetaryAmount',
      currency: 'USD',
      value: {
        '@type': 'QuantitativeValue',
        minValue: job.compRangeMin,
        maxValue: job.compRangeMax,
        unitText: 'YEAR',
      },
    } : undefined,
    occupationalCategory: job.specialty,
    qualifications: `Active medical license required in: ${job.location.state}`,
    skills: job.specialty,
    url: `${baseUrl}/jobs/${job.id}`,
    applicantLocationRequirements: {
      '@type': 'State',
      name: job.location.state,
    },
    jobLocationType: job.modality === 'telehealth' ? 'TELECOMMUTE' : undefined,
  };
}

export default function JobHead() {
  return null;
}

