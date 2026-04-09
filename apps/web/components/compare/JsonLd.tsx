/** Renders a JSON-LD <script> tag for structured data. Server-component safe.
 *  Safe usage: only pass static/hardcoded data objects — never user input. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Safe: data is always hardcoded structured data, never user-supplied content
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** VitalCV Organization schema — reuse across all marketing pages. */
export const ORGANIZATION_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'VitalCV',
  url: 'https://vitalcv.com',
  logo: 'https://vitalcv.com/logo.png',
  description:
    'Source-backed credentialing infrastructure for healthcare professionals and employers.',
  sameAs: ['https://twitter.com/vitalcv'],
};

/** Helper to build a FAQPage JSON-LD object from Q&A pairs. */
export function buildFaqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
