import { bus } from '../game/bus';
import { useGame } from '../game/store';
import { loadProfile } from '../meta/profile';
import { UNITS } from '../content';
import type { GameState, SimEvent } from '../sim/types';
import { BARBARIAN } from '../sim/types';
import type { UnitClass } from '../sim/defs';
import { glide, impulse, Synth } from './synth';
import { Score } from './music';
import { playSfx } from './sfx';
import { CRISIS_CHAPTER } from '../sim/roguelite/constants';
export { SFX_NAMES, EVENT_SFX_NAMES } from './sfx';
export type { KnownSfxName } from './sfx';

// String remains intentionally open: bus-only effects are also usable by UI callers.
export type SfxName = string;
export type Mood = 'menu' | 'calm' | 'tension' | 'war' | 'crisis' | 'chronicle' | 'victory' | 'defeat';
export interface AudioVolumes { master?: number; music?: number; sfx?: number }
export type HapticKind = 'tap' | 'impact' | 'success' | 'error' | 'mandate';
export interface AudioDiagnostics {
  state: AudioContextState | 'uninitialized' | 'unsupported'; era: number; mood: Mood;
  voices: number; layers: number; schedulerRunning: boolean; peak: number; rms: number;
  reduction: number; played: number; droppedEvents: number; lastSfx: string | null; error: string | null;
}
const HAPTICS: Record<HapticKind, number | number[]> = { tap: 8, impact: 24, success: [12, 45, 20], error: [15, 35, 15], mandate: [35, 40, 65] };
let lastHaptic = 0;
export function haptic(kind: HapticKind): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate || !loadProfile().settings.haptics) return;
  const now = performance.now();
  if (now - lastHaptic < 60) return;
  lastHaptic = now;
  navigator.vibrate(HAPTICS[kind]);
}

let context: AudioContext | null = null;
let synth: Synth | null = null;
let score: Score | null = null;
let master: GainNode | null = null;
let music: GainNode | null = null;
let effects: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;
let analyser: AnalyserNode | null = null;
let samples: Float32Array<ArrayBuffer> | null = null;
let nodes: AudioNode[] = [];
let unsubscribeBus: (() => void) | null = null;
let unsubscribeStore: (() => void) | null = null;
let podImpactTimer: number | undefined;
let era = 0;
let mood: Mood = 'menu';
let volumes: Required<AudioVolumes> = { master: 0.8, music: 0.5, sfx: 0.8 };
let pendingVolumes: AudioVolumes = {};
let unsupported = false;
let lastError: string | null = null;
let played = 0;
let droppedEvents = 0;
let lastSfx: string | null = null;
let tickCount = 0;
const eventTimes = new Map<string, number>();
let aiWindow = 0;
let aiCount = 0;

function resume(): void {
  if (context?.state === 'suspended' && !document.hidden) {
    void context.resume().catch((error: unknown) => { lastError = String(error); });
  }
}
function visibility(): void {
  if (!context) return;
  if (document.hidden) void context.suspend().catch((error: unknown) => { lastError = String(error); });
  else resume();
}
function setEra(value: number): void {
  if (!Number.isFinite(value)) return;
  era = Math.max(0, Math.min(5, Math.floor(value)));
  score?.set(mood, era);
}
function setMood(value: Mood): void {
  if (value !== mood) tickCount = 0;
  mood = value;
  score?.set(mood, era);
}
function syncState(): void {
  const store = useGame.getState();
  const state = store.state;
  if (!state || store.screen !== 'game') { score?.setStormIntensity(0); setMood('menu'); return; }
  setEra(state.run.era);
  const phase = state.run.phase;
  if (phase === 'chronicle' || phase === 'victory' || phase === 'defeat') { setMood(phase); return; }
  const human = state.players.find(player => player.isHuman);
  let nearbyStorms = 0;
  if (human) {
    const owned = state.map.tiles.filter(tile => tile.owner === human.id);
    for (const storm of state.storms) {
      const eye = state.map.tiles[storm.path[storm.step]];
      if (eye && owned.some(tile => Math.abs(tile.col - eye.col) + Math.abs(tile.row - eye.row) <= storm.radius + 3)) nearbyStorms++;
    }
    score?.setStormIntensity(Math.min(1, nearbyStorms / 3));
  } else score?.setStormIntensity(0);
  if (state.run.crisisActive || state.run.chapter === CRISIS_CHAPTER) { setMood('crisis'); return; }
  // Only visible Raiders count (nations are at peace): audio must not reveal fog-of-war information.
  if (human) {
    const cities = Object.values(state.cities).filter(city => city.owner === human.id);
    const near = Object.values(state.units).some(unit => {
      if (unit.owner !== BARBARIAN || human.vis[unit.tile] !== 2) return false;
      const tile = state.map.tiles[unit.tile];
      return tile && cities.some(city => {
        const home = state.map.tiles[city.tile];
        return home && Math.abs(home.col - tile.col) + Math.abs(home.row - tile.row) <= 4;
      });
    });
    if (near) { setMood('tension'); return; }
  }
  if (nearbyStorms > 0) { setMood('tension'); return; }
  setMood('calm');
}
function setVolumes(value: AudioVolumes): void {
  for (const key of ['master', 'music', 'sfx'] as const) {
    const v = value[key];
    if (v !== undefined && Number.isFinite(v)) {
      volumes[key] = Math.max(0, Math.min(1, v));
      pendingVolumes[key] = volumes[key];
    }
  }
  if (!context) return;
  const now = context.currentTime;
  if (master) glide(master.gain, volumes.master, now);
  if (music) glide(music.gain, volumes.music, now);
  if (effects) glide(effects.gain, volumes.sfx, now);
}
function sfx(name: SfxName, opts?: { pitch?: number; volume?: number }): void {
  if (!context || !synth || !effects || context.state !== 'running') return;
  const pitch = Number.isFinite(opts?.pitch) ? opts!.pitch! : 1;
  const volume = Number.isFinite(opts?.volume) ? Math.max(0, Math.min(2, opts!.volume!)) : 1;
  if (name === 'scoreSlam') score?.slam();
  if (mood === 'chronicle' && (name === 'chronicleTick' || name === 'renownAdd' || name === 'splendorAdd' || name === 'splendorMul')) {
    score?.chronicleProgress(++tickCount / 28);
  }
  playSfx(synth, effects, name, pitch, volume);
  played++;
  lastSfx = name;
  if (name === 'scoreSlam' || name === 'splendorMul' || name === 'attack') haptic('impact');
  else if (name === 'mandateLoss') haptic('mandate');
  else if (name === 'targetPass' || name === 'triumph' || name === 'victory') haptic('success');
  else if (name === 'error' || name === 'targetFail') haptic('error');
  else if (name === 'click' || name === 'tap' || name === 'select') haptic('tap');
}
function audible(state: GameState | null, event: SimEvent): boolean {
  if (!state) return true;
  const human = state.players.find(player => player.isHuman);
  if (!human) return true;
  if ('player' in event && event.player === human.id) return true;
  if (event.type === 'stormSpawned') {
    const eye = state.map.tiles[event.storm.path[event.storm.step]];
    return !!eye && state.map.tiles.some(tile => tile.owner === human.id && Math.abs(tile.col - eye.col) + Math.abs(tile.row - eye.row) <= event.storm.radius + 3);
  }
  if (event.type === 'combat') return event.attacker.player === human.id || event.defender.player === human.id || human.vis[event.defender.tile] === 2;
  if (event.type === 'unitMoved') return event.path.some(tile => human.vis[tile] === 2);
  if ('tile' in event && event.tile !== undefined) return human.vis[event.tile] === 2;
  if ('cityId' in event && event.cityId !== undefined) {
    const city = state.cities[event.cityId];
    return !!city && (city.owner === human.id || human.vis[city.tile] === 2);
  }
  if ('player' in event) return event.player === human.id;
  return true;
}
function handleBatch(events: SimEvent[]): void {
  const state = useGame.getState().state;
  const deadTypes = new Map<number, string>();
  for (const event of events) if (event.type === 'unitDied') deadTypes.set(event.unitId, event.unitType);
  const unitClass = (id?: number): UnitClass | undefined => {
    if (id === undefined) return undefined;
    const type = state?.units[id]?.type ?? deadTypes.get(id);
    return type ? UNITS[type]?.class : undefined;
  };
  for (const event of events) {
    if (event.type === 'eraStarted') setEra(event.era);
    if (event.type === 'crisisBegan') setMood('crisis');
    if (!audible(state, event)) continue;
    let sound: string | null = null;
    switch (event.type) {
      case 'unitMoved': {
        const cls = unitClass(event.unitId);
        sound = cls === 'mounted' ? 'hooves' : cls === 'armor' || cls === 'siege' ? 'wheels' : cls === 'naval' ? 'sail' : 'move';
        break;
      }
      case 'combat': {
        const cls = unitClass(event.attacker.unitId);
        const type = event.attacker.unitId === undefined ? undefined : state?.units[event.attacker.unitId]?.type ?? deadTypes.get(event.attacker.unitId);
        const modern = type ? (UNITS[type]?.era ?? 0) >= 3 : era >= 3;
        sound = cls === 'armor' || (modern && (cls === 'siege' || event.ranged)) ? 'cannon' : event.ranged ? 'arrows' : 'attack';
        break;
      }
      case 'unitDied': case 'cityGrew': case 'wonderBuilt': case 'borderGrew': case 'campCleared': case 'ruinExplored': case 'doctrineTriggered': sound = event.type; break;
      case 'cityFounded': sound = 'found'; break;
      case 'buildingBuilt': case 'improvementBuilt': sound = 'build'; break;
      case 'techResearched': sound = 'research'; break;
      case 'stormSpawned': sound = 'stormHowl'; break;
      case 'stormDamage': sound = 'stormHit'; break;
      case 'podLanded': sound = 'podStreak'; break;
      case 'colonistsThawed': sound = 'thaw'; break;
      case 'researchOffered': sound = 'breakthrough'; break;
      case 'cryoChanged': sound = 'cryo'; break;
      case 'unitPromoted': sound = 'levelUp'; break;
      case 'crisisBegan': sound = 'crisisAlarm'; break;
      case 'eraStarted': sound = 'eraFanfare'; break;
      case 'naturalWonderFound': sound = 'ruinExplored'; break;
      case 'renownGained': sound = 'renownAdd'; break;
      // Chronicle outcomes/stingers are UI-owned so they land on the ceremony, not sim dispatch.
    }
    if (!sound) continue;
    const now = context?.currentTime ?? 0;
    const ai = 'player' in event ? event.player !== 0 : event.type === 'combat' && event.attacker.player !== 0;
    if (now - aiWindow > 1) { aiWindow = now; aiCount = 0; }
    const interval = sound === 'doctrineTriggered' ? 0.12 : sound === 'stormHit' ? 0.24 : sound === 'stormHowl' ? 0.6 : ai ? 0.2 : 0.055;
    if (now - (eventTimes.get(sound) ?? -Infinity) < interval || (ai && aiCount >= 4)) { droppedEvents++; continue; }
    eventTimes.set(sound, now);
    if (ai) aiCount++;
    sfx(sound, { volume: ai ? 0.55 : 1 });
    if (sound === 'podStreak') {
      if (podImpactTimer !== undefined) window.clearTimeout(podImpactTimer);
      podImpactTimer = window.setTimeout(() => { podImpactTimer = undefined; sfx('podImpact'); }, 520);
    }
  }
  if (state) syncState();
}

/** First-gesture initialization. Repeated calls resume the same graph and never resubscribe. */
function init(): void {
  if (context) { resume(); return; }
  if (typeof window === 'undefined' || !window.AudioContext) { unsupported = true; return; }
  const settings = loadProfile().settings;
  volumes = { master: settings.master, music: settings.music, sfx: settings.sfx, ...pendingVolumes };
  context = new AudioContext({ latencyHint: 'interactive' });
  const c = context;
  master = c.createGain(); music = c.createGain(); effects = c.createGain();
  const dry = c.createGain();
  const send = c.createGain();
  const reverb = c.createConvolver();
  const wet = c.createGain();
  compressor = c.createDynamicsCompressor();
  compressor.threshold.value = -16; compressor.knee.value = 12; compressor.ratio.value = 5;
  compressor.attack.value = 0.003; compressor.release.value = 0.18;
  const limiter = c.createWaveShaper();
  const curve = new Float32Array(4097);
  for (let i = 0; i < curve.length; i++) curve[i] = 0.88 * Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 1.4);
  limiter.curve = curve;
  limiter.oversample = '2x';
  analyser = c.createAnalyser(); analyser.fftSize = 2048; samples = new Float32Array(analyser.fftSize);
  reverb.buffer = impulse(c); send.gain.value = 0.24; wet.gain.value = 0.38;
  music.connect(dry); effects.connect(dry); music.connect(send); effects.connect(send);
  send.connect(reverb).connect(wet).connect(dry);
  dry.connect(compressor).connect(limiter).connect(master).connect(analyser).connect(c.destination);
  nodes = [master, music, effects, dry, send, reverb, wet, compressor, limiter, analyser];
  master.gain.value = Math.max(0, Math.min(1, volumes.master));
  music.gain.value = Math.max(0, Math.min(1, volumes.music));
  effects.gain.value = Math.max(0, Math.min(1, volumes.sfx));
  synth = new Synth(c);
  score = new Score(synth, music);
  syncState(); score.set(mood, era); score.start();
  unsubscribeBus = bus.onBatch(handleBatch);
  unsubscribeStore = useGame.subscribe((next, previous) => {
    if (next.version !== previous.version || next.screen !== previous.screen || next.state !== previous.state) syncState();
  });
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pointerdown', resume, { passive: true });
  window.addEventListener('keydown', resume);
  resume();
}
function dispose(): void {
  unsubscribeBus?.(); unsubscribeStore?.(); unsubscribeBus = null; unsubscribeStore = null;
  if (podImpactTimer !== undefined && typeof window !== 'undefined') window.clearTimeout(podImpactTimer);
  podImpactTimer = undefined;
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility);
  if (typeof window !== 'undefined') { window.removeEventListener('pointerdown', resume); window.removeEventListener('keydown', resume); }
  score?.stop(); synth?.stop();
  nodes.forEach(node => node.disconnect()); nodes = [];
  if (context) void context.close().catch((error: unknown) => { lastError = String(error); });
  context = null; synth = null; score = null; master = null; music = null; effects = null; compressor = null; analyser = null; samples = null;
  eventTimes.clear(); aiCount = 0; aiWindow = 0; tickCount = 0;
}
function diagnostics(): AudioDiagnostics {
  let peak = 0, energy = 0;
  if (analyser && samples) {
    analyser.getFloatTimeDomainData(samples);
    for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
  }
  return { state: context?.state ?? (unsupported ? 'unsupported' : 'uninitialized'), era, mood,
    voices: synth?.activeVoices ?? 0, layers: score?.layerCount ?? 0, schedulerRunning: score?.schedulerRunning ?? false,
    peak, rms: samples ? Math.sqrt(energy / samples.length) : 0, reduction: compressor?.reduction ?? 0,
    played, droppedEvents, lastSfx, error: lastError };
}

/**
 * Call init from the first user gesture; imports and pre-init sfx calls remain silent.
 * Pitch is a frequency ratio (1 = original, 2 = octave); volumes are linear 0..1.
 * Initial volumes/haptics come from the profile. setVolumes changes the live mix only;
 * settings UI remains responsible for persisting its profile changes.
 *
 * State subscriptions choose menu / exploration / war / crisis / ceremony moods and
 * ignore unseen enemies. UI can set a ceremony mood and optionally synchronize its
 * progress; scoreSlam silences that score until the next mood/era transition. Outcomes
 * are UI-owned so victory/failure stingers land on the visible reveal, not dispatch.
 *
 * diagnostics samples the post-limiter signal on demand (no metering timer in-game).
 * dispose releases every source, timer, node, listener, and subscription; init can
 * recreate the engine afterward. Background visibility suspends the audio clock.
 */
export const audio = {
  init, sfx, setEra, setMood, setVolumes, haptic,
  /** Optional precise ceremony synchronization; scoreSlam automatically drops the score. */
  setChronicleProgress(progress: number): void { if (Number.isFinite(progress)) score?.chronicleProgress(progress); },
  diagnostics, dispose,
};
if (import.meta.hot) import.meta.hot.dispose(dispose);
