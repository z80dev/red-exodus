import { useEffect, useState } from 'react';
import { audio, EVENT_SFX_NAMES, SFX_NAMES } from '../audio';
import type { Mood } from '../audio';
import { ERA_NAMES } from '../sim/roguelite/constants';

const MOODS: Mood[] = ['menu', 'calm', 'tension', 'war', 'crisis', 'chronicle', 'victory', 'defeat'];
const PALETTES = ['Cold analog drone / distant wind', 'Two-note piano beacon / thin wind', 'Piano pulse / warmer synth haze', 'Layered piano / soft counterline', 'Full pluck motif / bright harmonics', 'Hopeful piano / richest synth horizon'];
const label = (name: string) => name.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase());

/** Standalone sound desk. Diagnostics sample the real post-limiter output, not mock meters. */
export default function AudioDemo() {
  const [meter, setMeter] = useState(audio.diagnostics());
  const [era, setEra] = useState(0);
  const [mood, setMood] = useState<Mood>('menu');
  const [last, setLast] = useState('Awaiting first gesture');
  const [volumes, setVolumes] = useState({ master: 0.8, music: 0.5, sfx: 0.8 });
  const [pitch, setPitch] = useState(1);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setMeter(audio.diagnostics()), 90);
    return () => { window.clearInterval(timer); audio.dispose(); };
  }, []);
  const play = (name: string) => { audio.init(); audio.sfx(name, { pitch }); setLast(label(name)); };
  const running = meter.state === 'running';
  return <main className="audio-desk">
    <style>{`
      * { box-sizing: border-box; }
      body { margin: 0; background: #080e19; }
      .audio-desk { position: fixed; inset: 0; height: 100dvh; overflow: auto; color: #ece8de; font: 14px/1.5 system-ui, sans-serif; padding: max(24px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) 40px; background: radial-gradient(ellipse at 75% 0%, #27303880, transparent 55%), #080e19; }
      .audio-wrap { max-width: 1180px; margin: auto; }
      .audio-kicker { color: #c9aa6d; letter-spacing: .23em; font-size: 10px; font-weight: 700; text-transform: uppercase; }
      .audio-head { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
      .audio-head h1 { font: 500 clamp(29px, 5vw, 46px)/1.15 Georgia, serif; letter-spacing: -.035em; margin: 10px 0; }
      .audio-muted { color: #96a1b0; margin: 0; }
      .audio-desk button { color: #ddd8cb; background: #182130; border: 1px solid #354052; border-radius: 8px; min-height: 44px; padding: 10px 13px; cursor: pointer; font: inherit; text-align: left; transition: background .15s, border-color .15s; }
      .audio-desk button:hover { border-color: #c6ab70; background: #263246; }
      .audio-desk button:focus-visible, .audio-desk input:focus-visible { outline: 2px solid #dfc48c; outline-offset: 3px; }
      .audio-desk button[aria-pressed=true] { border-color: #b69b64; background: #b4985d25; color: #f5dca7; }
      .audio-desk .audio-start { background: #dfc48c; color: #101622; font-weight: 700; padding: 13px 23px; white-space: nowrap; }
      .audio-desk .audio-start:hover { background: #f0d9a7; color: #101622; }
      .audio-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; }
      .audio-panel { border: 1px solid #2c3745; border-radius: 14px; padding: 22px; background: #111a27d9; margin-bottom: 20px; }
      .audio-panel h2 { font: 500 22px Georgia, serif; margin: 0 0 16px; }
      .audio-row { display: flex; gap: 8px; flex-wrap: wrap; }
      .audio-eras { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .audio-caption { color: #bbaa8e; font-size: 12px; min-height: 18px; margin: 12px 0 23px; }
      .audio-sounds { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
      .audio-sounds button { font-size: 12px; padding: 9px 11px; }
      .audio-meter { display: flex; align-items: end; gap: 4px; height: 65px; margin: 17px 0; }
      .audio-meter span { flex: 1; height: 100%; border-radius: 2px; background: #263043; transition: background .08s; }
      .audio-readout { font: 29px/1.2 ui-monospace, monospace; color: #e0c58d; }
      .audio-status { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #b9c4d0; }
      .audio-status i { width: 6px; height: 6px; border-radius: 50%; background: #a99978; }
      .audio-status.live i { background: #81c5a6; box-shadow: 0 0 10px #81c5a680; }
      .audio-stat { display: flex; justify-content: space-between; border-top: 1px solid #293343; padding: 10px 0; font-size: 12px; color: #a7b1bd; }
      .audio-stat strong { color: #e4ddce; font-weight: 500; }
      .audio-control { display: block; margin: 16px 0; font-size: 12px; color: #b6bfca; }
      .audio-control span { display: flex; justify-content: space-between; }
      .audio-desk input[type=range] { width: 100%; min-height: 36px; accent-color: #d9bb7c; cursor: pointer; }
      .audio-note { font-size: 11px; color: #8390a2; margin-top: 16px; }
      .audio-footer { padding-top: 5px; color: #68768a; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
      @media(max-width: 800px) { .audio-layout { grid-template-columns: minmax(0, 1fr) 240px; gap: 12px; } .audio-panel { padding: 16px; } .audio-sounds { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      @media(max-width: 600px) { .audio-head { align-items: start; flex-direction: column; gap: 12px; } .audio-layout { display: flex; flex-direction: column; } .audio-monitor { order: -1; } .audio-monitor .audio-panel { margin-bottom: 0; } .audio-mix { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; } .audio-eras { grid-template-columns: repeat(2, 1fr); } .audio-sounds { grid-template-columns: repeat(3, minmax(0, 1fr)); } .audio-meter { height: 32px; } .audio-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; } .audio-readout { font-size: 23px; } .audio-note { margin-bottom: 0; } }
    `}</style>
    <div className="audio-wrap">
      <header className="audio-head"><div><div className="audio-kicker">RED EXODUS · Martian sound desk</div><h1>The sound of making it.</h1><p className="audio-muted">Six eras. One stubborn piano. Wind, wire and a little hope.</p></div>
        <button className="audio-start" onClick={() => { audio.init(); audio.setVolumes(volumes); setLast('Sound engine awakened'); }}>{running ? 'Resume sound' : 'Awaken sound'}</button>
      </header>
      <div className="audio-layout"><div>
        <section className="audio-panel"><h2>Adaptive score</h2><div className="audio-eras">{ERA_NAMES.map((name, i) => <button key={name} aria-pressed={era === i} onClick={() => { audio.init(); audio.setEra(i); setEra(i); }}>{String(i + 1).padStart(2, '0')} · {name}</button>)}</div>
          <p className="audio-caption">{PALETTES[era]}</p><div className="audio-row">{MOODS.map(value => <button key={value} aria-pressed={mood === value} onClick={() => { audio.init(); audio.setMood(value); setMood(value); }}>{label(value)}</button>)}</div>
          <label className="audio-control"><span>Chronicle intensity <strong>{Math.round(progress * 100)}%</strong></span><input aria-label="Chronicle intensity" type="range" min="0" max="1" step="0.01" value={progress} onChange={event => { const value = Number(event.target.value); setProgress(value); audio.setChronicleProgress(value); }} /></label>
          <p className="audio-note">Score slam drops the Chronicle music on impact. Change mood to begin a fresh phrase.</p>
        </section>
        <section className="audio-panel"><h2>The interaction orchestra</h2><label className="audio-control"><span>Chime pitch <strong>{pitch.toFixed(2)}×</strong></span><input aria-label="Chime pitch" type="range" min="0.5" max="2" step="0.05" value={pitch} onChange={event => setPitch(Number(event.target.value))} /></label><div className="audio-sounds">{SFX_NAMES.map(name => <button key={name} onClick={() => play(name)}>{label(name)}</button>)}</div></section>
        <section className="audio-panel"><h2>Life on the map</h2><div className="audio-sounds">{EVENT_SFX_NAMES.map(name => <button key={name} onClick={() => play(name)}>{label(name)}</button>)}</div></section>
      </div><aside className="audio-monitor"><section className="audio-panel">
        <div className={`audio-status ${running ? 'live' : ''}`}><i />{meter.state.toUpperCase()} · STEREO OUTPUT</div>
        <div className="audio-meter" aria-label={`Peak ${meter.peak.toFixed(3)}`}>{Array.from({ length: 24 }, (_, i) => <span key={i} style={{ background: meter.peak * 32 > i ? (i > 20 ? '#d9907e' : '#bca776') : undefined, height: `${35 + i * 2.7}%` }} />)}</div>
        <div className="audio-readout">{meter.peak > 0.00001 ? (20 * Math.log10(meter.peak)).toFixed(1) : '−∞'} <small>dBFS</small></div>
        <p className="audio-caption" aria-live="polite">{last}</p>
        <div className="audio-stats"><div className="audio-stat">Voices <strong>{meter.voices} / 144</strong></div><div className="audio-stat">Score layers <strong>{meter.layers} / 4</strong></div><div className="audio-stat">Reduction <strong>{meter.reduction.toFixed(1)} dB</strong></div><div className="audio-stat">RMS <strong>{meter.rms.toFixed(3)}</strong></div></div>
        <div className="audio-mix">{(['master', 'music', 'sfx'] as const).map(key => <label className="audio-control" key={key}><span>{label(key)} <strong>{Math.round(volumes[key] * 100)}%</strong></span><input aria-label={`${key} volume`} type="range" min="0" max="1" step="0.01" value={volumes[key]} onChange={event => { const value = Number(event.target.value); setVolumes(previous => ({ ...previous, [key]: value })); audio.setVolumes({ [key]: value }); }} /></label>)}</div>
        <button onClick={() => { audio.dispose(); setLast('Engine stopped · all voices released'); }}>Stop & release audio</button>
        <p className="audio-note">Real post-limiter analysis. Synthesized instruments, stereo convolution and ambience. No audio assets. Background tabs suspend automatically.</p>
        {meter.error && <p role="alert">{meter.error}</p>}
      </section></aside></div>
      <footer className="audio-footer">RED EXODUS sound desk / WebAudio synthesis / gesture to begin</footer>
    </div>
  </main>;
}
