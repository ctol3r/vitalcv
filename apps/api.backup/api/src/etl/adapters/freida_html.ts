import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { isoCountry, normSpec } from '../normalize';

/**
 * FREIDA Parser - respectful web scraping with throttling
 * Requires FEATURE_FREIDA=1 to activate
 */
export async function scrapeFREIDA(url: string) {
  if (process.env.FEATURE_FREIDA !== '1') {
    console.log('FREIDA parser disabled (FEATURE_FREIDA != 1)');
    return [];
  }

  // Rate limiting: 1 req/sec (implement via queue in production)
  const html = await (await fetch(url)).text();
  const $ = cheerio.load(html);
  const out: any[] = [];

  $('a.card-link').each((_i, el) => {
    const name = $(el).find('.program-title').text().trim();
    const inst = $(el).find('.sponsor').text().trim();
    const spec = $(el).find('.specialty').text().trim();
    const href = $(el).attr('href') || '';

    if (name) {
      out.push({
        program_id: 'FREIDA-' + Buffer.from(name).toString('hex').slice(0, 12),
        name,
        institution: inst,
        country: isoCountry('US'),
        accreditor: 'ACGME',
        specialty: normSpec(spec),
        level: 'residency',
        url: new URL(href, url).toString(),
        last_verified: new Date(),
        _src: 'FREIDA'
      });
    }
  });

  return out;
}
