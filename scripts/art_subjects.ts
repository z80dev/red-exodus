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

function sceneText(kind: ContentKind, entry: ContentEntry): { subject: string; hue?: number } {
  const safeName = entry.name.replace(/\bflags?\b/gi, 'crew patch').replace(/\bbanners?\b/gi, 'mission emblem');
  const context = [safeName, entry.description, entry.flavor].filter(Boolean).join('. ')
    .replace(/\*\*/g, '').replace(/\{[^}]*\}/g, '').replace(/\b\d+(?:\.\d+)?\s*%?/g, '')
    .replace(/\bplant a flag on Mars\b/gi, 'complete humanity’s first EVA on Mars')
    .replace(/\bflags?\b/gi, 'emblem').replace(/\bbanners?\b/gi, 'mission marker')
    .replace(/[“”"‘’]/g, '').replace(/[+×]/g, ' ')
    .replace(/\.{2,}/g, '.').replace(/\s+/g, ' ').trim();
  const motif = entry.motif ? `Use a subtle ${entry.motif.replace(/_/g, ' ')}-shaped prop or silhouette.` : '';
  if (kind === 'doctrines') {
    const colors = entry.nationColors?.map(colorName);
    const insignia = colors?.length
      ? `Apply this nation's palette (${[...new Set(colors)].join(', ')}) only as separated tiny stitch marks and asymmetrical suit trim; do not make a rectangular badge or flag-like layout.`
      : 'Use restrained rust, habitat-white and cryo-cyan mission trim.';
    return {
      subject: `A single fictional person in a functional Mars EVA crew suit, inspired by Crew card ${entry.name}. Make their occupation clear from the title through a distinctive job prop and a small wry survival detail. Live content context (visual inspiration only, never visible writing): ${context}. ${insignia} Square joker-card illustration with mischievous character, one clear expressive face and bold silhouette, crisp hand-painted gouache. No text, name, words, letters, numbers, flags, stars, stripes, banners, or logo.`,
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
for (const kind of KINDS) {
  const { entries, source } = await readContent(kind);
  const subjects = Object.fromEntries(entries.map((entry) => [entry.id, sceneText(kind, entry)]));
  writeFileSync(join(SUBJECTS, `${kind}.json`), `${JSON.stringify(subjects, null, 1)}\n`);
  console.log(`${kind}: ${entries.length} subjects from live ${source}`);
}
