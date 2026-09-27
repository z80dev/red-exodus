#!/usr/bin/env bun
// Content reader for the art pipeline: the id / name / text / hue of every illustrated content entry.
//   bun scripts/art_content.ts <leaders|doctrines|edicts|crises|omens|reforms>   → review table on stdout
// Loads the real registry; when a sibling's half-written sim module breaks the import graph, falls back
// to scanning the content source for `id: '…', name: '…'` entry heads so art work never blocks on it.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type ContentKind = 'leaders' | 'doctrines' | 'edicts' | 'crises' | 'omens' | 'reforms';

export interface ContentEntry {
  id: string;
  name: string;
  description: string;
  flavor: string;
  hue?: number;
  motif?: string;
  /** rarity / tier / eras, whatever the kind has */
  tag: string;
}

const ROOT = resolve(import.meta.dir, '..');
const REGISTRY: Record<ContentKind, string> = {
  leaders: 'LEADERS', doctrines: 'DOCTRINES', edicts: 'EDICTS', crises: 'CRISES', omens: 'OMENS', reforms: 'REFORMS',
};

interface LooseDef {
  id: string; name: string; description?: string; flavor?: string; rewardText?: string; rarity?: string; tier?: number;
  eras?: number[]; art?: { hue: number; motif: string }; portrait?: { hue: number; motif: string }; icon?: string;
}

function fromRegistry(rec: Record<string, LooseDef>): ContentEntry[] {
  return Object.values(rec).map((d) => {
    const art = d.art ?? d.portrait;
    return {
      id: d.id, name: d.name, description: d.description ?? '', flavor: d.flavor ?? d.rewardText ?? '',
      hue: art?.hue, motif: art?.motif ?? d.icon,
      tag: d.rarity ?? (d.tier !== undefined ? `tier ${d.tier}` : d.eras ? `eras ${d.eras.join(',')}` : ''),
    };
  });
}

const STR = String.raw`(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|\x60((?:[^\x60\\]|\\.)*)\x60)`;
const HEAD = new RegExp(String.raw`^\s+id: '([a-z0-9_]+)', name: ${STR}`, 'gm');
const field = (block: string, key: string) => {
  const m = new RegExp(String.raw`\b${key}: ${STR}`).exec(block);
  return m ? (m[1] ?? m[2] ?? m[3]).replace(/\\(.)/g, '$1') : '';
};

function fromSource(kind: ContentKind): ContentEntry[] {
  const src = readFileSync(join(ROOT, 'src', 'content', `${kind}.ts`), 'utf8');
  const heads = [...src.matchAll(HEAD)];
  return heads.map((m, i) => {
    const block = src.slice(m.index, heads[i + 1]?.index ?? src.length);
    const art = /\b(?:art|portrait): \{ hue: (\d+), motif: '([a-z]+)'/.exec(block);
    return {
      id: m[1], name: (m[2] ?? m[3] ?? m[4]).replace(/\\(.)/g, '$1'),
      description: field(block, 'description'), flavor: field(block, 'flavor') || field(block, 'rewardText'),
      hue: art ? Number(art[1]) : undefined, motif: art?.[2] ?? (field(block, 'icon') || undefined),
      tag: field(block, 'rarity') || (/\beras: \[([\d, ]+)\]/.exec(block)?.[1] ?? ''),
    };
  });
}

export async function readContent(kind: ContentKind): Promise<{ entries: ContentEntry[]; source: 'registry' | 'source-scan' }> {
  try {
    // Runtime-selected module (one per kind); a static import would tie every kind to every sibling module.
    const mod = (await import(`../src/content/${kind}.ts`)) as Record<string, Record<string, LooseDef>>;
    return { entries: fromRegistry(mod[REGISTRY[kind]]), source: 'registry' };
  } catch {
    return { entries: fromSource(kind), source: 'source-scan' };
  }
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
