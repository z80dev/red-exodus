// Leaf module (no runtime imports): the Crew registry every crew file registers into at evaluation
// time. Keeping it dependency-free makes registration immune to import-cycle order.
import type { DoctrineDef } from '../sim/defs';

export const DOCTRINES: Record<string, DoctrineDef> = {};

export function registerCrew(list: readonly DoctrineDef[]): void {
  for (const d of list) DOCTRINES[d.id] = d;
}
