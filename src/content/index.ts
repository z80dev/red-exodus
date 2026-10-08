// Content registries. Each file is owned by one agent (see docs/ARCHITECTURE.md).
export * from './terrain';
export * from './resources';
export * from './improvements';
export * from './units';
export * from './buildings';
export * from './wonders';
export * from './techs';
export * from './promotions';
export * from './naturalWonders';
export * from './pillars';
export * from './doctrines';
export * from './edicts';
export * from './crises';
export * from './leaders';
export * from './commanders';
export * from './ascension';
export * from './nationCrew';
export * from './crewMars';

// Crew files self-register into DOCTRINES (doctrineRegistry.ts); imported here for that side effect.
import './crewCommon';
import './crewUncommon';
import './crewRare';
