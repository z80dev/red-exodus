#!/usr/bin/env bun
// Writes prompt subjects from the live content barrel for every card-art kind.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readContent, type ContentKind, type ContentEntry } from './art_content';

const ROOT = resolve(import.meta.dir, '..');
const SUBJECTS = join(ROOT, 'art', 'gen', 'subjects');
const KINDS: readonly ContentKind[] = ['doctrines', 'edicts', 'crises', 'omens', 'reforms'];

function colorName(hex: string): string {
  const value = Number.parseInt(hex.replace(/^#/, ''), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  if (light > 0.88) return 'white';
  if (light < 0.16) return 'near-black';
  const delta = max - min;
  const hue = delta === 0 ? 0 : max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  const degrees = ((hue * 60 + 360) % 360);
  const family = degrees < 18 || degrees >= 345 ? 'red' : degrees < 44 ? 'orange' : degrees < 68 ? 'yellow-gold' : degrees < 160 ? 'green' : degrees < 195 ? 'teal' : degrees < 258 ? 'blue' : degrees < 290 ? 'violet' : degrees < 345 ? 'magenta' : 'red';
  return light > 0.65 ? `pale ${family}` : light < 0.32 ? `deep ${family}` : family;
}

// Crew art variety: one generator + one template paints 174 near-identical crouching astronauts, so each card draws a
// deterministic shot / setting / look / action from its id. Names that read as groups get a small crew.
const SHOTS = [
  'tight head-and-shoulders portrait, face filling the upper half',
  'waist-up portrait, three-quarter view, leaning toward the viewer',
  'full-body action shot, dynamic diagonal pose, low camera angle',
  'over-the-shoulder shot of them at work, face turned back to the viewer',
  'seated portrait with their gear spread around them, eye-level camera',
  'dramatic low-angle hero shot against the sky',
  'mid-shot caught mid-gesture, arms animated, telling a story',
  'close-up of hands and face as they work on the prop',
];
const SETTINGS = [
  'inside a cramped pressurized hab module with warm lamp light and hanging cables (helmet off)',
  'in a humid hydroponic greenhouse dome full of green leaves (helmet off)',
  'in a rover cockpit, dashboard glow on the face (helmet off)',
  'outside in a howling rust dust storm, visor lit from within',
  'in a lava-tube cavern lit by work lamps and glowing fungus (visor up)',
  'in a mission control room with flickering amber screens (helmet off)',
  'in an airlock mid-cycle, frost venting around them',
  'at a scrappy colony market stall stacked with salvage (helmet off)',
  'on a polar ice field under a pale sun, breath fogging the visor',
  'on a ridge at blue Martian sunset, colony lights below',
  'in a machine workshop with sparks and half-built robots (helmet off)',
  'in a mess hall with a long table and mismatched mugs (helmet off)',
];
const LOOKS = [
  'weathered woman in her sixties with cropped silver hair', 'wiry young man with a shaved head and a scar',
  'broad-shouldered woman with braids and laugh lines', 'lanky teenager in an oversized hand-me-down suit',
  'stocky middle-aged man with a thick beard and reading glasses', 'elegant older man with slicked-back grey hair',
  'freckled woman with wild red curls tied up', 'soft-spoken man with round glasses and ink-stained fingers',
  'tall woman with a buzz cut and tattooed forearms', 'tired-eyed woman in her forties with a messy bun',
  'grinning man with a gap-toothed smile and a bandana', 'serene woman with a headscarf under her comms cap',
];
const MOODS = ['smug', 'exhausted but determined', 'gleefully scheming', 'deadpan', 'wide-eyed and delighted', 'grim', 'serenely calm', 'mid-laugh'];

function pick<T>(list: readonly T[], id: string, salt: number): T {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return list[(h >>> 0) % list.length];
}

// Card motif ids are shared with the procedural SVG art and are Earth-flavored (horse, crown, temple…); prompts use
// the Mars reading of each so a crisis never grows a cavalry charge.
const MARS_MOTIF: Record<string, string> = {
  horse: 'dune-buggy', crown: 'commander-helmet', temple: 'memorial-dome', pyramid: 'sintered-bunker', castle: 'shielded-dome',
  sword: 'rail-rifle', shield: 'riot-shield', lyre: 'radio', laurel: 'mission-patch', scroll: 'data-tablet', book: 'field-manual',
  chalice: 'water-canister', feather: 'solar-sail', owl: 'drone', lion: 'mission-emblem', eagle: 'mission-emblem',
  serpent: 'coiled-hose', key: 'keycard', mask: 'gas-mask', tree: 'greenhouse-sapling', ship: 'rocket', anchor: 'tether-anchor',
  wheat: 'hydroponic-sprout', tower: 'antenna-mast', coin: 'credit-chip',
};

function sceneText(kind: ContentKind, entry: ContentEntry): { subject: string; hue?: number } {
  const safeName = entry.name.replace(/\bflags?\b/gi, 'crew patch').replace(/\bbanners?\b/gi, 'mission emblem');
  const context = [safeName, entry.description, entry.flavor].filter(Boolean).join('. ')
    .replace(/\*\*/g, '').replace(/\{[^}]*\}/g, '').replace(/\b\d+(?:\.\d+)?\s*%?/g, '')
    .replace(/\bplant a flag on Mars\b/gi, 'complete humanity’s first EVA on Mars')
    .replace(/\bflags?\b/gi, 'emblem').replace(/\bbanners?\b/gi, 'mission marker')
    .replace(/[“”"‘’]/g, '').replace(/[+×]/g, ' ')
    .replace(/\.{2,}/g, '.').replace(/\s+/g, ' ').trim();
  const motif = entry.motif ? `Use a subtle ${(MARS_MOTIF[entry.motif] ?? entry.motif).replace(/_/g, ' ')}-shaped prop or silhouette.` : '';
  if (kind === 'doctrines') {
    const colors = entry.nationColors?.map(colorName);
    const insignia = colors?.length
      ? `Apply this nation's palette (${[...new Set(colors)].join(', ')}) only as separated tiny stitch marks and asymmetrical suit trim; do not make a rectangular badge or flag-like layout.`
      : 'Use restrained rust, habitat-white and cryo-cyan mission trim.';
    const group = /\b(crew|team|pair|two|rangers|guys|squad|club|union|council|survivors|brothers|sisters|mycologists|drummers|watch|singers|traders|keepers|masons|scribes|riders|heralds)\b/i.test(entry.name);
    const who = group
      ? `a small crew of two or three distinct colonists (varied ages, builds and skin tones), led by a ${pick(LOOKS, entry.id, 3)}`
      : `a single ${pick(LOOKS, entry.id, 3)}`;
    return {
      subject: `Crew card portrait of ${who}, ${pick(MOODS, entry.id, 4)}, inspired by the Mars colony character ${entry.name}. ${pick(SHOTS, entry.id, 1)}, ${pick(SETTINGS, entry.id, 2)}. Their job must read instantly from one oversized, distinctive prop or tool they are actively using, plus one small wry survival detail. Character context (visual inspiration only, never visible writing): ${context}. Suits and clothing are practical, patched Mars colony workwear — vary the silhouette, not always a white spacesuit. ${insignia} Joker-card energy: characterful face, bold readable silhouette, crisp hand-painted gouache. No text, name, words, letters, numbers, flags, stars, stripes, banners, or logo.`,
      hue: entry.hue,
    };
  }
  if (kind === 'edicts') {
    return {
      subject: `A striking square-card tableau for a single piece of Martian colony salvage called ${entry.name}: depict its most legible physical form or a colonist using it, with a clear prop that communicates its use. Theme drawn from this catalog description, never rendered as text: ${context}. ${motif} Witty, tactile, immediately readable.`,
      hue: entry.hue,
    };
  }
  if (kind === 'crises') {
    return {
      subject: `A cinematic Martian colony hazard named ${entry.name}: show one specific visible disaster pressing against a tiny vulnerable habitat and its crew, using this crisis description and flavor as visual cues only, not words: ${context}. ${motif} Ominous, fair and readable at small card size; include one small practical human response.`,
      hue: entry.hue,
    };
  }
  if (kind === 'omens') {
    return {
      subject: `A vivid Mars Directive scene called ${entry.name}: one small suited colonist or crew team visibly carries out the directive's task on a hostile red planet. Use this objective and its reward only as visual inspiration, never as text or a diagram: ${context}. ${motif} One clear action, a wry survival-game twist, compact centered composition.`,
      hue: entry.hue,
    };
  }
  return {
    subject: `A distinctive Ark Module for the Mars colony called ${entry.name}: an instantly recognizable piece of practical habitat or life-support infrastructure, with a tiny suited crew member showing its scale. Its function is suggested by this catalog entry, not written anywhere: ${context}. ${motif} Monumental but plausible engineering, clear centered silhouette, hopeful Mars light.`,
    hue: entry.hue,
  };
}

mkdirSync(SUBJECTS, { recursive: true });
const only = process.argv.slice(2);
for (const kind of KINDS.filter((k) => !only.length || only.includes(k))) {
  const { entries, source } = await readContent(kind);
  const subjects = Object.fromEntries(entries.map((entry) => [entry.id, sceneText(kind, entry)]));
  writeFileSync(join(SUBJECTS, `${kind}.json`), `${JSON.stringify(subjects, null, 1)}\n`);
  console.log(`${kind}: ${entries.length} subjects from live ${source}`);
}
