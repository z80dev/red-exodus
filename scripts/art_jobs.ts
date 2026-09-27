#!/usr/bin/env bun
// Builds Nous Portal batch job files art/gen/<kind>.json from the hand-written scene subjects in
// art/gen/subjects/<kind>.json plus the content registries (ids, art hue). Recipe: art/gen/STYLE.md.
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

// Style exploration (art/previews/gen_styletest.png): Seedream holds the bold-silhouette card look best and
// outputs native 16:9 / 9:16 backdrops; GPT Image 2.5 paints the strongest faces for portraits.
const SEEDREAM = 'bytedance/seedream/v5/pro/text-to-image';
const PORTRAIT_MODEL = 'openai/gpt-image-2.5/sunburst/text-to-image';

// The ink vignette is applied in post (scripts/art_post.py): asked for in the prompt, Seedream paints
// inconsistent torn-paper / oval frames that read as a border on full-screen backdrops.
const STYLE =
  'painterly stylized fantasy-historical illustration, hand-painted digital oil with visible confident brushstrokes, ' +
  'bold simplified chunky shapes, one clear readable focal silhouette, {LIGHT}, limited rich palette with deep ink-navy ' +
  'shadows and gold-leaf highlights, full-bleed painting that fills the entire canvas edge to edge, premium AAA ' +
  'card-game art in the spirit of Hades, Civilization VI and Slay the Spire';
// Cards and portraits sit in dark gold frames: low-key light whose painted shadows deepen toward the corners.
// Backdrops sit behind titles full-screen: open, luminous skies.
const CARD_LIGHT =
  'dramatic low-key chiaroscuro, strong warm rim light, luminous glow against deep darkness, the painted scene ' +
  'itself falls into deep shadow toward the corners';
const BACKDROP_LIGHT = 'dramatic chiaroscuro, strong warm rim light, luminous glow';
const NEGATIVE =
  'No text, no letters, no writing, no numbers, no runes, no inscriptions, no border, no frame, no torn paper edges, ' +
  'no vignette mask, no UI, no watermark, no signature.';

const FRAMING: Record<Kind, string> = {
  leaders:
    'Half-length hero portrait of a fictional leader, three-quarter view, eyes to the viewer, face in the upper third, ' +
    'regal and characterful, dramatic rim light from behind one shoulder, their emblem glowing faintly in the dark background.',
  doctrines:
    'Square card illustration: a single iconic emblematic subject centred, embodying the idea, instantly legible at small size.',
  edicts:
    'Square card illustration: a decisive action frozen at its peak, symbolic tarot-like composition, centred and near-symmetrical.',
  crises:
    'Square card illustration: an ominous catastrophe of epic scale looming over small silhouetted people or a city, ' +
    'darkness and storm pressing in from the edges, cold palette with one sickly or fiery accent.',
  omens:
    'Square card vignette: a single celestial portent or sacred object floating on a dark starry ground, soft haze, ' +
    'strongly centred with generous negative space.',
  reforms:
    'Square card vignette: a civic institution or symbol presented as a monument on a dark ground, calm and dignified, ' +
    'gold rim light, strongly centred with generous negative space.',
  eras:
    'Epic panoramic establishing matte painting of a fictional civilisation, wide vista, huge sky, strong era lighting, ' +
    'calm uncluttered sky area in the upper middle for a title.',
  key:
    'Epic cinematic key art matte painting, grand vista, calm uncluttered area in the upper middle for a game logo.',
};

const PORTRAIT_FRAMING =
  'Tall vertical phone-wallpaper composition: the vista reframed vertically, the focal landmark in the lower-middle third, ' +
  'towering sky above.';

const PALETTE: [number, string][] = [
  [15, 'crimson and ember red'], [40, 'burnt orange and copper'], [60, 'amber and gold'],
  [85, 'olive and chartreuse'], [150, 'emerald and jade green'], [185, 'teal and verdigris'],
  [215, 'azure and cerulean blue'], [250, 'sapphire and royal blue'], [285, 'violet and amethyst'],
  [320, 'magenta and plum'], [345, 'rose and wine red'], [361, 'crimson and ember red'],
];
const paletteFor = (hue: number) => PALETTE.find(([max]) => (((hue % 360) + 360) % 360) < max)![1];

const CONTENT_KINDS: Record<Kind, ContentKind | null> = {
  leaders: 'leaders', doctrines: 'doctrines', edicts: 'edicts', crises: 'crises', omens: 'omens', reforms: 'reforms',
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
    // Several vignettes per generation (STYLE.md "Sheets"): one shared style pass, split by art_post.py.
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
        model: SEEDREAM,
        layout,
        cells: group.map((s) => s.id),
      });
    }
  }
  for (const { id, subject, hue } of SHEET_KINDS.includes(kind) ? [] : scenes) {
    const palette = hue === undefined ? '' : ` Dominant palette: ${paletteFor(hue)}, with ink-navy shadows and gold highlights.`;
    const variants: [string, Aspect, string][] = backdrop
      ? [[id, 'landscape', 'Wide 16:9 landscape composition.'], [`${id}-portrait`, 'portrait', PORTRAIT_FRAMING]]
      : [[id, kind === 'leaders' ? 'portrait' : 'square', '']];
    for (const [file, aspect, extra] of variants) {
      jobs.push({
        out: `art/gen/out/${kind}/${file}.png`,
        prompt: `${subject} ${FRAMING[kind]}${extra ? ' ' + extra : ''}${palette} ${style}`,
        aspect,
        model: kind === 'leaders' ? PORTRAIT_MODEL : SEEDREAM,
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
