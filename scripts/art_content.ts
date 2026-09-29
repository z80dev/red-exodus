#!/usr/bin/env bun
// Content reader for the art pipeline, sourced from the live content barrel.
// `index.ts` evaluates Crew registration before exposing the combined DOCTRINES registry.
//   bun scripts/art_content.ts <leaders|doctrines|edicts|crises|omens|reforms> → review table on stdout
import * as CONTENT from '../src/content/index';

export type ContentKind = 'leaders' | 'doctrines' | 'edicts' | 'crises' | 'omens' | 'reforms';

export interface ContentEntry {
  id: string;
  name: string;
  description: string;
  flavor: string;
  hue?: number;
  motif?: string;
  nation?: string;
  nationColors?: string[];
  /** rarity / tier / eras, whatever the kind has */
  tag: string;
}

const REGISTRY: Record<ContentKind, string> = {
  leaders: 'LEADERS', doctrines: 'DOCTRINES', edicts: 'EDICTS', crises: 'CRISES', omens: 'OMENS', reforms: 'REFORMS',
};

interface LooseDef {
  id: string; name: string; description?: string; flavor?: string; rewardText?: string; rarity?: string; tier?: number;
  eras?: number[]; art?: { hue: number; motif: string }; portrait?: { hue: number; motif: string }; icon?: string;
  nation?: string; flagColors?: string[];
}

function fromRegistry(
  rec: Record<string, LooseDef>,
  leaders?: Record<string, LooseDef>,
): ContentEntry[] {
  return Object.values(rec).map((d) => {
    const art = d.art ?? d.portrait;
    return {
      id: d.id, name: d.name, description: d.description ?? '', flavor: d.flavor ?? d.rewardText ?? '',
      hue: art?.hue, motif: art?.motif ?? d.icon, nation: d.nation,
      nationColors: d.nation ? leaders?.[d.nation]?.flagColors : d.flagColors,
      tag: d.rarity ?? (d.tier !== undefined ? `tier ${d.tier}` : d.eras ? `eras ${d.eras.join(',')}` : ''),
    };
  });
}


export async function readContent(kind: ContentKind): Promise<{ entries: ContentEntry[]; source: 'registry' }> {
  const mod = CONTENT as unknown as Record<string, Record<string, LooseDef>>;
  return { entries: fromRegistry(mod[REGISTRY[kind]], mod.LEADERS), source: 'registry' };
}

if (import.meta.main) {
  const kind = process.argv[2] as ContentKind;
  if (!(kind in REGISTRY)) {
    console.error(`usage: bun scripts/art_content.ts <${Object.keys(REGISTRY).join('|')}>`);
    process.exit(1);
  }
  const { entries, source } = await readContent(kind);
  console.log(`${kind}: ${entries.length} entries (${source})`);
  for (const e of entries) {
    console.log([e.id, e.name, e.tag, `${e.hue ?? '-'}/${e.motif ?? '-'}`, e.description.replace(/\s+/g, ' '), e.flavor].join(' | '));
  }
}
