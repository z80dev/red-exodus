// Pause menu: resume, quick settings (volumes, quality), full settings, save & exit, abandon run.
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { audio } from '../../audio';
import { getRenderer } from '../../game/bridge';
import { saveRun } from '../../game/save';
import { useGame, useSim } from '../../game/store';
import { loadProfile, saveProfile, updateSettings } from '../../meta/profile';
import type { Profile } from '../../meta/profile';
import { HUMAN } from '../../sim/types';
import { Icon } from '../icons/Icon';
import { Button, Chip, ConfirmDialog, Modal, Ornament } from '../kit';
import { chapterLabel } from './format';
import { T } from '../terms';

type Settings = Profile['settings'];

export function PauseMenu() {
  const info = useSim((s) => ({ seed: s.config.seed, turn: s.turn, era: s.run.era, chapter: s.run.chapter, civ: s.players[HUMAN].civName, leader: s.players[HUMAN].name, asc: s.config.ascension }));
  const [settings, setSettings] = useState<Settings>(() => loadProfile().settings);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const close = () => { audio.sfx('close'); useGame.getState().setPanel('none'); };
  if (!info) return null;

  const change = (patch: Partial<Settings>) => {
    const next = updateSettings(loadProfile(), patch);
    saveProfile(next);
    setSettings(next.settings);
    if (patch.master != null || patch.music != null || patch.sfx != null) audio.setVolumes(patch);
    if (patch.quality) getRenderer()?.setQuality(patch.quality);
  };

  const saveExit = async () => {
    const g = useGame.getState();
    if (!g.state) return;
    setSaving(true);
    audio.sfx('click');
    await saveRun(g.state);
    g.setPanel('none');
    g.select(null);
    g.setScreen('menu');
  };

  return (
    <Modal onClose={close} className="pm">
      <div className="pm__eyebrow">{info.civ} · {info.leader}</div>
      <h2 className="k-title pm__title">Paused</h2>
      <div className="pm__meta">
        <span>{chapterLabel(info.era, info.chapter)}</span>
        <span>Turn {info.turn}</span>
        {info.asc > 0 && <span>{T.ascension} {info.asc}</span>}
        <span className="pm__seed"><Icon name="seed" size={13} /> {info.seed}</span>
      </div>
      <Ornament />
      <Button variant="gold" className="pm__main" onClick={close}><Icon name="next" size={18} /> Resume</Button>

      <div className="pm__settings">
        {(['master', 'music', 'sfx'] as const).map((k) => (
          <label key={k} className="pm-vol">
            <span>{k === 'master' ? 'Master' : k === 'music' ? 'Music' : 'Effects'}</span>
            <input type="range" min={0} max={1} step={0.05} value={settings[k]} aria-label={`${k} volume`}
              style={{ '--v': settings[k] } as CSSProperties}
              onChange={(e) => change({ [k]: Number(e.target.value) })}
              onPointerUp={() => { if (k !== 'music') audio.sfx('click'); }} />
            <output className="num">{Math.round(settings[k] * 100)}</output>
          </label>
        ))}
        <div className="pm-row">
          <span>Graphics</span>
          <span className="pm-row__chips">
            <Chip active={settings.quality === 'high'} onClick={() => change({ quality: 'high' })}>High</Chip>
            <Chip active={settings.quality === 'low'} onClick={() => change({ quality: 'low' })}>Battery saver</Chip>
          </span>
        </div>
        <div className="pm-row">
          <span>Animations</span>
          <span className="pm-row__chips">
            <Chip active={!settings.fastAnimations} onClick={() => change({ fastAnimations: false })}>Full</Chip>
            <Chip active={settings.fastAnimations} onClick={() => change({ fastAnimations: true })}>Fast</Chip>
          </span>
        </div>
      </div>

      <div className="pm__list">
        <Button onClick={() => { audio.sfx('open'); const g = useGame.getState(); g.setPanel('none'); g.setScreen('settings'); }}><Icon name="settings" size={18} /> All settings</Button>
        <Button onClick={() => void saveExit()} disabled={saving}><Icon name="back" size={18} /> {saving ? 'Saving…' : 'Save and quit'}</Button>
        <Button variant="danger" onClick={() => { audio.sfx('open'); setConfirm(true); }}><Icon name="skull" size={18} /> Abandon run</Button>
      </div>
      <p className="pm__note">The game saves after every move.</p>

      {confirm && (
        <ConfirmDialog
          title="Abandon this run?"
          body={<>This run with <b>{info.civ}</b> ends now. You cannot get it back.</>}
          icon="skull"
          danger
          confirmLabel="Abandon run"
          onCancel={() => setConfirm(false)}
          onConfirm={() => { setConfirm(false); audio.sfx('defeat'); void useGame.getState().abandonRun(); }}
        />
      )}
    </Modal>
  );
}
