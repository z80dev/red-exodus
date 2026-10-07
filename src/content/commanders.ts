// Every Ark offers two commanders (one female, one male): same nation and rules, different face and name.
import type { CommanderGender, LeaderDef } from '../sim/defs';

export interface Commander {
  name: string;
  title: string;
  description: string;
  gender: CommanderGender;
  /** id in the `leaders` art manifest */
  artId: string;
  alt: boolean;
}

export function commanderOf(leader: LeaderDef, alt = false): Commander {
  if (!alt) return { name: leader.name, title: leader.title, description: leader.description, gender: leader.gender, artId: leader.id, alt: false };
  return { ...leader.alt, artId: `${leader.id}_alt`, alt: true };
}
