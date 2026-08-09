import { describe, it, expect } from 'vitest';
import {
  INSTITUTIONS,
  KIND_LABEL,
  institutionsByKind,
  searchInstitutions,
  type InstitutionKind,
} from '@/lib/institutions/curated';

describe('curated institution data', () => {
  it('has globally unique ids in kebab-case', () => {
    const ids = INSTITUTIONS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('every entry has a valid kind and a non-empty name', () => {
    const kinds = new Set(Object.keys(KIND_LABEL));
    for (const inst of INSTITUTIONS) {
      expect(kinds.has(inst.kind)).toBe(true);
      expect(inst.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('covers every declared kind', () => {
    const by = institutionsByKind();
    for (const k of Object.keys(KIND_LABEL) as InstitutionKind[]) {
      expect(by[k].length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate names within a kind', () => {
    const by = institutionsByKind();
    for (const list of Object.values(by)) {
      const names = list.map((i) => i.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('search matches by abbrev, name-prefix, and scopes by kind', () => {
    expect(searchInstitutions('ABIM').some((i) => i.id === 'abim')).toBe(true);
    expect(searchInstitutions('harvard').some((i) => i.id === 'harvard-ms')).toBe(true);
    const schools = searchInstitutions('university', {
      kinds: ['med_school_md', 'med_school_do'],
    });
    expect(schools.length).toBeGreaterThan(0);
    expect(schools.every((i) => i.kind.startsWith('med_school'))).toBe(true);
  });

  it('carries every CMSS member society (57 as of 2026-08-09), searchable by abbrev', () => {
    // cmss.org/membership/current-members — completion delta landed 2026-08.
    const cmssDelta = [
      'aasld',
      'aace',
      'aes',
      'amia',
      'ascp-pathology',
      'asge',
      'asrm',
      'asam',
      'asbrs',
      'ase-echo',
      'cap-pathologists',
      'naspghan',
      'nass',
      'oma',
      'paltmed',
      'svs',
      'sgim',
      'sgo',
      'sir',
      'snmmi',
      'sso',
      'sts',
    ];
    const byId = new Map(INSTITUTIONS.map((i) => [i.id, i]));
    for (const id of cmssDelta) {
      const inst = byId.get(id);
      expect(inst, `missing CMSS society: ${id}`).toBeDefined();
      expect(inst?.kind).toBe('society');
      if (inst?.abbrev) {
        expect(
          searchInstitutions(inst.abbrev, { kinds: ['society'] }).some((r) => r.id === id),
          `abbrev search failed for ${id}`,
        ).toBe(true);
      }
    }
    const societyCount = INSTITUTIONS.filter((i) => i.kind === 'society').length;
    expect(societyCount).toBeGreaterThanOrEqual(57);
  });
});
