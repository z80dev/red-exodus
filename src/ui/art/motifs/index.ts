// Card-art / heraldry motif illustrations (100×100 grid, same layer format as icons — see ui/icons/glyph.ts).
// Paints inside art: 'm' gilded ivory (gradient), 'a' hue-derived jewel accent, 'h' white glaze, 'k' hue-tinted
// shade, 'd' deep hue-tinted ink, 'p' parchment. The renderer adds a dark keyline around non-inner layers.
import type { Glyph } from '../../icons/glyph';
import { MOTIFS_A } from './motifsA';
import { MOTIFS_B } from './motifsB';

/** The 40 motif values allowed in `art.motif`, `portrait.motif`, `portrait.crest` (docs/ARCHITECTURE.md). */
export const MOTIF_IDS = [
  'sun', 'moon', 'star', 'river', 'wave', 'mountain', 'tree', 'wheat', 'coin', 'scroll',
  'flask', 'lyre', 'laurel', 'crown', 'sword', 'shield', 'tower', 'castle', 'anchor', 'ship',
  'horse', 'flame', 'eye', 'key', 'hourglass', 'skull', 'compass', 'gear', 'bolt', 'feather',
  'hand', 'book', 'temple', 'pyramid', 'mask', 'chalice', 'serpent', 'owl', 'lion', 'eagle',
] as const;
export type MotifId = (typeof MOTIF_IDS)[number];

const ALL: Record<string, Glyph> = { ...MOTIFS_A, ...MOTIFS_B };

export function isMotif(id: string): id is MotifId {
  return Object.hasOwn(ALL, id);
}

/** Motif illustration by id; unknown ids get the star (never throws). */
export function motifGlyph(id: string): Glyph {
  return (Object.hasOwn(ALL, id) ? ALL[id] : undefined) ?? ALL.star ?? ALL.sun;
}
