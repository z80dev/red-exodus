// The AEONS icon registry: every named glyph + resolution of arbitrary content ids to a glyph.
import type { Glyph } from './glyph';
import { CORE_GLYPHS } from './glyphs/core';
import { GAME_GLYPHS } from './glyphs/game';
import { UNIT_GLYPHS } from './glyphs/units';
import { MOTIF_GLYPHS } from './glyphs/motifs';
import { RESOURCE_GLYPHS } from './glyphs/resources';
import { BUILDING_GLYPHS } from './glyphs/buildings';
import { WONDER_GLYPHS } from './glyphs/wonders';
import {
  BUILDINGS, CRISES, DOCTRINES, EDICTS, IMPROVEMENTS, LEADERS, NATURAL_WONDERS, OMENS, PROMOTIONS, REFORMS,
  RESOURCES, SCROLLS, TECHS, UNITS, WONDERS,
} from '../../content';

const BASE = {
  ...CORE_GLYPHS,
  ...GAME_GLYPHS,
  ...UNIT_GLYPHS,
  ...MOTIF_GLYPHS,
  ...RESOURCE_GLYPHS,
  ...BUILDING_GLYPHS,
  ...WONDER_GLYPHS,
};

const ANY: Record<string, Glyph> = BASE;
function recolor(name: string, c: string): Glyph {
  return { ...(ANY[name] ?? ANY.column), c };
}

/** Pillar emblems reuse their motif glyph, tinted with the pillar color. */
const PILLAR_GLYPHS = {
  arts: recolor('lyre', 'var(--p-arts)'),
  discovery: recolor('flask', 'var(--p-discovery)'),
  commerce: recolor('coin', 'var(--p-commerce)'),
  conquest: recolor('war', 'var(--p-conquest)'),
  prosperity: recolor('wheat', 'var(--p-prosperity)'),
  glory: recolor('column', 'var(--p-glory)'),
};

export const GLYPHS = { ...BASE, ...PILLAR_GLYPHS };

/** Every icon with a dedicated glyph. `<Icon>` also accepts any content id (falls back to a category glyph). */
export type IconName = keyof typeof GLYPHS;
export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];

const NAMED: Record<string, Glyph> = GLYPHS;

export function isIconName(name: string): name is IconName {
  return Object.hasOwn(NAMED, name);
}

/** model-key prefixes and `kind:id` forms map straight to a content category */
const PREFIX_CATEGORY: Record<string, string> = {
  res: 'resource', resource: 'resource',
  imp: 'improvement', improvement: 'improvement',
  bld: 'building', building: 'building',
  w: 'wonder', wonder: 'wonder',
  nw: 'wonder',
  tech: 'tech',
  u: 'melee', unit: 'melee',
};

function named(name: string | undefined): Glyph | undefined {
  return name !== undefined && Object.hasOwn(NAMED, name) ? NAMED[name] : undefined;
}

/** Category glyph for a content id found in one of the registries (or undefined). */
function fromContent(id: string): Glyph | undefined {
  if (RESOURCES[id]) return named(RESOURCES[id].icon) ?? NAMED.resource;
  if (IMPROVEMENTS[id]) return named(IMPROVEMENTS[id].icon) ?? NAMED.improvement;
  const b = BUILDINGS[id];
  if (b) return named(b.icon) ?? named(b.replaces) ?? NAMED.building;
  if (WONDERS[id]) return named(WONDERS[id].icon) ?? NAMED.wonder;
  if (NATURAL_WONDERS[id]) return NAMED.mountain ?? NAMED.wonder;
  if (TECHS[id]) return named(TECHS[id].icon) ?? NAMED.tech;
  const un = UNITS[id];
  if (un) return named(un.icon) ?? named(un.class) ?? NAMED.melee;
  if (DOCTRINES[id]) return named(DOCTRINES[id].icon) ?? NAMED.doctrine;
  if (EDICTS[id]) return named(EDICTS[id].icon) ?? NAMED.edict;
  if (SCROLLS[id]) return named(SCROLLS[id].icon) ?? NAMED.scroll;
  if (CRISES[id]) return named(CRISES[id].icon) ?? NAMED.crisis;
  if (OMENS[id]) return named(OMENS[id].icon) ?? NAMED.omen;
  if (REFORMS[id]) return named(REFORMS[id].icon) ?? NAMED.reform;
  if (PROMOTIONS[id]) return named(PROMOTIONS[id].icon) ?? NAMED.promote;
  if (LEADERS[id]) return NAMED.crown;
  return undefined;
}

const warned: Record<string, true> = {};

/** Resolve any name/content id to a glyph. Never fails: unknown names render the neutral star. */
export function resolveGlyph(name: string): Glyph {
  const direct = named(name);
  if (direct) return direct;
  const m = /^([a-z]+)[:_/](.+)$/.exec(name);
  if (m && PREFIX_CATEGORY[m[1]]) {
    return named(m[2]) ?? fromContent(m[2]) ?? NAMED[PREFIX_CATEGORY[m[1]]];
  }
  const c = fromContent(name);
  if (c) return c;
  if (import.meta.env.DEV && !warned[name]) {
    warned[name] = true;
    console.warn(`[Icon] unknown icon "${name}" — rendering fallback`);
  }
  return NAMED.star ?? NAMED.info;
}
