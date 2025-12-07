import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { isoCountry, normSpec } from '../normalize';

/**
 * Global Fellowships Parser - international program catalog
 * Requires FEATURE_GLOBAL_FELLOWSHIPS=1 to activate
 */
export async function scrapeGlobalFellowships(url: string) {
  if (process.env.FEATURE_GLOBAL_FELLOWSHIPS !== '1') {
    console.log('Global Fellowships parser disabled (FEATURE_GLOBAL_FELLOWSHIPS != 1)');
    return [];
  }

  const html = await (await fetch(url)).text();
  const $ = cheerio.load(html);
  const out: any[] = [];

  $('li.program').each((_i, li) => {
    const name = $(li).find('.name').text().trim();
    const inst = $(li).find('.inst').text().trim();
    const country = $(li).find('.country').text().trim() || 'US';
    const spec = $(li).find('.spec').text().trim() || 'global health';
    const href = $(li).find('a').attr('href') || '';

    if (name) {
      out.push({
        program_id: 'GF-' + Buffer.from(name).toString('hex').slice(0, 12),
        name,
        institution: inst,
        country: isoCountry(country),
        accreditor: 'VAR',
        specialty: normSpec(spec),
        level: 'fellowship',
        url: href,
        last_verified: new Date(),
        _src: 'GLOBAL_FELLOWSHIPS'
      });
    }
  });

  return out;
}
