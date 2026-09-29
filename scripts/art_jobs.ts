#!/usr/bin/env bun
// Builds Bankr LLM Gateway batch job files art/gen/<kind>.json (run with scripts/bankr_image.py) from the scene subjects in
// art/gen/subjects/<kind>.json and, where relevant, the content registries (ids, art hue). Recipe: art/gen/STYLE.md.
//   bun scripts/art_jobs.ts [kind ...]      (default: every kind)
// Subjects file shape: { "<id>": "scene text" } or { "<id>": { "subject": "...", "hue": 210 } }.
// Content-backed kinds report ids that lack a subject (no job is written for them) and stale subjects.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readContent, type ContentKind } from './art_content';

const ROOT = resolve(import.meta.dir, '..');
const GEN = join(ROOT, 'art', 'gen');

type Kind = 'leaders' | 'doctrines' | 'edicts' | 'crises' | 'omens' | 'reforms' | 'eras' | 'key';
type Aspect = 'square' | 'portrait' | 'landscape';
interface Job {
  out: string; prompt: string; aspect: Aspect; model: string;
  /** sheet jobs: ids of the cells in reading order, split by scripts/art_post.py */
  cells?: string[]; layout?: '2x2' | '1x2';
}

// Every kind renders through the Bankr LLM Gateway on GPT Image 2.5 Flare (generation only; no reference edits).
const IMAGE_MODEL = 'gpt-image-2.5-flare';

// art_post.py applies one consistent vignette so generated art remains full-bleed.
const STYLE =
  'painterly-but-graphic science-fiction concept illustration, hand-painted digital gouache and oil with visible confident ' +
  'brushwork, bold simplified forms, one clear readable focal silhouette, {LIGHT}, Mars regolith, butterscotch dust, basalt ' +
  'shadows and restrained cryo-cyan highlights, full-bleed premium strategy-game art';
const CARD_LIGHT =
  'dramatic Mars sunlight, crisp rust-orange rim light separating the subject from basalt shadow, luminous habitat glow';
const BACKDROP_LIGHT = 'dramatic cinematic Mars sunlight, crisp rim-lit forms, atmospheric dust glow';
const NEGATIVE =
  'No text, letters, writing, numbers, flags, logos, borders, frames, UI, watermark, signature, gore, photorealism, ' +
  'glossy 3D render, anime.';

const FRAMING: Record<Kind, string> = {
  leaders:
    'Half-length portrait of a fictional adult commander, three-quarter view, direct distinctive gaze, face in upper-middle third, ' +
    'practical pressure-rated Mars suit with restrained national insignia colors only as shoulder-panel accents, never a flag; ' +
    'abstract mission crest and habitat background, no ceremonial fantasy costume.',
  doctrines:
    'Square Crew card: a single fictional Mars-colony person or small crew, expressive face, recognizable job prop, joker-card wit, ' +
    'one crisp focal silhouette; the character and equipment, not an abstract emblem, are the subject.',
  edicts:
    'Square Salvage card: one memorable physical tool, cache, module, or colonist using it; a readable action with clever visual wit.',
  crises:
    'Square Crisis card: one dramatic Mars hazard pressing against a tiny vulnerable habitat and crew; ominous scale, one hazard accent.',
  omens:
    'Square Directive card: a suited colonist or crew team visibly carrying out one concrete mission objective in the Martian landscape.',
  reforms:
    'Square Ark Module card: one distinctive practical habitat or life-support installation with a tiny suited crew member for scale.',
  eras:
    'Epic panoramic establishing matte painting of Mars colonization, clear focal habitat or landmark, calm upper-middle sky for title.',
  key:
    'Epic cinematic RED EXODUS key art matte painting, grand Mars vista, calm uncluttered upper-middle title space.',
};

const PORTRAIT_FRAMING =
  'Tall vertical phone-wallpaper composition: vista reframed vertically, focal landmark in lower-middle third, towering sky above.';


const PALETTE: [number, string][] = [
  [15, 'crimson and ember red'], [40, 'burnt orange and copper'], [60, 'amber and gold'],
  [85, 'olive and chartreuse'], [150, 'emerald and jade green'], [185, 'teal and verdigris'],
  [215, 'azure and cerulean blue'], [250, 'sapphire and royal blue'], [285, 'violet and amethyst'],
  [320, 'magenta and plum'], [345, 'rose and wine red'], [361, 'crimson and ember red'],
];
const paletteFor = (hue: number) => PALETTE.find(([max]) => (((hue % 360) + 360) % 360) < max)![1];

const CONTENT_KINDS: Record<Kind, ContentKind | null> = {
  leaders: null, doctrines: 'doctrines', edicts: 'edicts', crises: 'crises', omens: 'omens', reforms: 'reforms',
  eras: null, key: null,
};
/** Simpler vignette kinds painted four to a sheet (a 1×2 pair for a leftover of one or two). */
const SHEET_KINDS: Kind[] = ['omens', 'reforms'];

const ALL: Kind[] = ['leaders', 'doctrines', 'edicts', 'crises', 'omens', 'reforms', 'eras', 'key'];
const kinds = (process.argv.slice(2) as Kind[]).filter((k) => ALL.includes(k));
if (process.argv.length > 2 && kinds.length !== process.argv.length - 2) {
  console.error(`unknown kind; expected any of ${ALL.join(' ')}`);
  process.exit(1);
}

for (const kind of kinds.length ? kinds : ALL) {
  const subjectsPath = join(GEN, 'subjects', `${kind}.json`);
  if (!existsSync(subjectsPath)) {
    console.log(`${kind}: no subjects file, skipped`);
    continue;
  }
  const raw = JSON.parse(readFileSync(subjectsPath, 'utf8')) as Record<string, string | { subject: string; hue?: number }>;
  const contentKind = CONTENT_KINDS[kind];
  const content = contentKind ? await readContent(contentKind) : null;
  const hues: Record<string, number | undefined> = {};
  for (const e of content?.entries ?? []) hues[e.id] = e.hue;
  const ids = content ? content.entries.map((e) => e.id) : Object.keys(raw);
  const missing = ids.filter((id) => !raw[id]);
  const stale = content ? Object.keys(raw).filter((id) => !(id in hues)) : [];
  const jobs: Job[] = [];
  const backdrop = kind === 'eras' || kind === 'key';
  const style = `Style: ${STYLE.replace('{LIGHT}', backdrop ? BACKDROP_LIGHT : CARD_LIGHT)}. ${NEGATIVE}`;
  const scenes = ids.flatMap((id) => {
    const entry = raw[id];
    if (!entry) return [];
    const { subject, hue: subjectHue } = typeof entry === 'string' ? { subject: entry, hue: undefined } : entry;
    const hue = subjectHue ?? hues[id];
    return [{ id, subject, hue }];
  });
  if (SHEET_KINDS.includes(kind)) {
    // Generate shared-style sheets, then split them into individual art files in art_post.py.
    for (let i = 0; i < scenes.length; i += 4) {
      const group = scenes.slice(i, i + 4);
      const layout = group.length > 2 ? '2x2' : '1x2';
      const positions = layout === '2x2' ? ['Top-left', 'Top-right', 'Bottom-left', 'Bottom-right'] : ['Left', 'Right'];
      const cells = group.map(
        (s, n) => `${positions[n]}: ${s.subject}${s.hue === undefined ? '' : ` Palette: ${paletteFor(s.hue)}.`}`,
      );
      jobs.push({
        out: `art/gen/out/${kind}/_sheet_${String(i / 4).padStart(2, '0')}.png`,
        prompt:
          `${layout === '2x2' ? 'Four' : 'Two'} separate square card vignette paintings arranged in a precise ` +
          `${layout === '2x2' ? '2×2 grid' : 'side-by-side pair'} that exactly fills the canvas; each painting fills ` +
          'exactly its own equal cell edge to edge, the cells divided only by a thin straight dark gap, all in one ' +
          `identical style. ${cells.join(' ')} ` +
          `Each cell: ${FRAMING[kind]} ${style}`,
        aspect: layout === '2x2' ? 'square' : 'landscape',
        model: IMAGE_MODEL,
        layout,
        cells: group.map((s) => s.id),
      });
    }
  }
  for (const { id, subject, hue } of SHEET_KINDS.includes(kind) ? [] : scenes) {
    const palette = hue === undefined ? '' : ` Mars rust and basalt dominate; use ${paletteFor(hue)} only as a small light or equipment accent.`;
    const variants: [string, Aspect, string][] = backdrop
      ? [[id, 'landscape', 'Wide 16:9 landscape composition.'], [`${id}-portrait`, 'portrait', PORTRAIT_FRAMING]]
      : [[id, kind === 'leaders' ? 'portrait' : 'square', '']];
    for (const [file, aspect, extra] of variants) {
      jobs.push({
        out: `art/gen/out/${kind}/${file}.png`,
        prompt: `${subject} ${FRAMING[kind]}${extra ? ' ' + extra : ''}${palette} ${style}`,
        aspect,
        model: IMAGE_MODEL,
      });
    }
  }
  writeFileSync(join(GEN, `${kind}.json`), JSON.stringify(jobs, null, 1) + '\n');
  console.log(
    `${kind}: ${jobs.length} jobs for ${scenes.length} ids` +
      (content ? ` (${content.entries.length} content ids via ${content.source})` : '') +
      (missing.length ? ` · MISSING subjects (${missing.length}): ${missing.join(' ')}` : '') +
      (stale.length ? ` · stale subjects: ${stale.join(' ')}` : ''),
  );
}
