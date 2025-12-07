// src/services/pubmed.ts — minimal PubMed E-utilities search (title / author)

import fetch from 'node-fetch';

export async function searchPubMed(query: string, max=10) {

  const es = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=${max}&term=${encodeURIComponent(query)}`).then(r=>r.json());

  const ids: string[] = es.esearchresult?.idlist||[];

  if (!ids.length) return [];

  const sum = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`).then(r=>r.json());

  return ids.map(id => {

    const s = sum.result[id]||{};

    return { pmid:id, title:s.title||"", journal:s.fulljournalname||s.source||"", year:s.pubdate?.slice(0,4), authors:(s.authors||[]).map((a:any)=>a.name) };

  });

}

