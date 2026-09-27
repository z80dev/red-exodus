// Art2D gallery: every icon at 14/20/32px on ink and parchment, RichText samples, all card-art motifs,
// crests, leader portraits, the logo. `?dev=Art2DGallery&section=icons|text|cards|heraldry|logo&set=<glyph set>`
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '../ui/icons/Icon';
import { RichText } from '../ui/icons/RichText';
import { CORE_GLYPHS } from '../ui/icons/glyphs/core';
import { GAME_GLYPHS } from '../ui/icons/glyphs/game';
import { UNIT_GLYPHS } from '../ui/icons/glyphs/units';
import { MOTIF_GLYPHS } from '../ui/icons/glyphs/motifs';
import { RESOURCE_GLYPHS } from '../ui/icons/glyphs/resources';
import { BUILDING_GLYPHS } from '../ui/icons/glyphs/buildings';
import { WONDER_GLYPHS } from '../ui/icons/glyphs/wonders';
import { CardArt } from '../ui/art/CardArt';
import { Emblem, Logo } from '../ui/art/Logo';
import { Crest } from '../ui/art/Crest';
import { LeaderPortrait } from '../ui/art/LeaderPortrait';
import { LEADERS } from '../content';
import { MOTIF_IDS } from '../ui/art/motifs';
import type { Rarity } from '../sim/types';

const SETS: Record<string, string[]> = {
  core: Object.keys(CORE_GLYPHS),
  pillars: ['arts', 'discovery', 'commerce', 'conquest', 'prosperity', 'glory'],
  game: Object.keys(GAME_GLYPHS),
  units: Object.keys(UNIT_GLYPHS),
  motifs: Object.keys(MOTIF_GLYPHS),
  resources: Object.keys(RESOURCE_GLYPHS),
  buildings: Object.keys(BUILDING_GLYPHS),
  wonders: Object.keys(WONDER_GLYPHS),
};

const params = new URLSearchParams(location.search);
const onlySection = params.get('section');
const onlySet = params.get('set');
/** `&sizes=48,96` to inspect glyph detail */
const onlyMotif = params.get('motif')?.split(',');
const CARD_W = Number(params.get('cardw') ?? 150);
const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];
const inkOnly = params.get('bg') === 'ink';
const SIZES = (params.get('sizes') ?? '14,20,32').split(',').map(Number);

const page: CSSProperties = {
  position: 'fixed', inset: 0, overflow: 'auto', touchAction: 'pan-y', userSelect: 'text',
  background: 'radial-gradient(1200px 800px at 20% -10%, #1a2336 0%, var(--ink-950) 60%)',
  padding: '24px clamp(12px, 3vw, 40px) 80px',
};
const h2: CSSProperties = { fontFamily: 'var(--font-display)', color: 'var(--gold-400)', letterSpacing: '0.08em', fontSize: 20, margin: '32px 0 12px' };
const h3: CSSProperties = { fontFamily: 'var(--font-display)', color: 'var(--text-dim)', letterSpacing: '0.06em', fontSize: 14, margin: '18px 0 8px', textTransform: 'uppercase' };

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  if (onlySection && onlySection !== id) return null;
  return (
    <section>
      <h2 style={h2}>{title}</h2>
      {children}
    </section>
  );
}

function IconCell({ name, parchment }: { name: string; parchment: boolean }) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 4px 8px',
        borderRadius: 10, minWidth: 92,
        background: parchment ? 'linear-gradient(#f3e8cb, #e4d4ad)' : 'rgba(255,255,255,0.03)',
        border: parchment ? '1px solid #bca574' : '1px solid rgba(224,184,74,0.12)',
        color: parchment ? '#3b2c16' : 'var(--text)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '0 6px' }}>
        {SIZES.map((sz) => <Icon key={sz} name={name} size={sz} />)}
      </div>
      <div style={{ fontSize: 10, opacity: 0.75, fontFamily: 'ui-monospace, monospace', textAlign: 'center', wordBreak: 'break-all' }}>{name}</div>
    </div>
  );
}

function IconGrid({ names }: { names: string[] }) {
  const [parch, setParch] = useState(false);
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button type="button" onClick={() => setParch(false)} style={{ opacity: parch ? 0.5 : 1 }}>ink</button>
        <button type="button" onClick={() => setParch(true)} style={{ opacity: parch ? 1 : 0.5 }}>parchment</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {names.map((n) => <IconCell key={n} name={n} parchment={parch} />)}
      </div>
      {!inkOnly && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {names.map((n) => <IconCell key={n} name={n} parchment />)}
        </div>
      )}
    </div>
  );
}

const SAMPLES = [
  '+2 {food} and +1 {prod} on river tiles.',
  'Cities with a **Library** gain +3 {sci}. ×1.5 {splendor} if your Focus is {icon:discovery} **Discovery**.',
  '+50 {renown} per wonder · +4 {splendor} · −1 {mandate} if you make peace.',
  'Gain 3 {influence} per chapter per 3 cities. Luxuries give +2 {happy}; each city costs -1 {happy}.',
  'Unlocks {icon:res_iron} Iron and {icon:bld_workshop} Workshop. x2 {gold} from trade routes.\nSecond line: {cul} +25% culture.',
];

export default function Art2DGallery() {
  return (
    <div style={page}>
      <h1 style={{ fontFamily: 'var(--font-deco)', color: 'var(--gold-300)', fontSize: 28, margin: 0 }}>AEONS · 2D art gallery</h1>
      <Section id="logo" title="Logo & emblem">
        <div style={{ display: 'grid', gap: 24, justifyItems: 'start' }}>
          <Logo height={120} tagline />
          <Logo height={56} />
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            {[16, 32, 64, 128].map((s) => <Emblem key={s} size={s} />)}
            <div style={{ padding: 16, background: 'linear-gradient(#f3e8cb, #e4d4ad)', borderRadius: 12 }}>
              <Logo height={64} sheen={false} />
            </div>
          </div>
        </div>
      </Section>
      <Section id="icons" title="Icons">
        {Object.entries(SETS)
          .filter(([k]) => !onlySet || onlySet === k)
          .map(([k, names]) => (
            <div key={k}>
              <h3 style={h3}>{k} · {names.length}</h3>
              <IconGrid names={names} />
            </div>
          ))}
      </Section>
      <Section id="cards" title="Card art · 40 motifs">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {MOTIF_IDS.filter((m) => !onlyMotif || onlyMotif.includes(m)).map((m, i) => (
            <figure key={m} style={{ margin: 0, width: CARD_W }}>
              <div style={{ width: CARD_W, aspectRatio: '5 / 7', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
                <CardArt hue={(i * 47) % 360} motif={m} rarity={RARITIES[i % 4]} />
              </div>
              <figcaption style={{ fontSize: 11, textAlign: 'center', marginTop: 4, color: 'var(--text-dim)', fontFamily: 'ui-monospace, monospace' }}>{m}</figcaption>
            </figure>
          ))}
        </div>
        <h3 style={h3}>square · animated · rarities</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {RARITIES.map((r, i) => (
            <div key={r} style={{ width: 120, height: 120, borderRadius: 12, overflow: 'hidden' }}>
              <CardArt hue={[210, 150, 340, 42][i]} motif={['compass', 'tree', 'serpent', 'crown'][i]} rarity={r} aspect="square" animate />
            </div>
          ))}
        </div>
      </Section>
      <Section id="heraldry" title="Crests & leader portraits">
        <h3 style={h3}>crests · shield & round · 20 / 32 / 64 / 110</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-end' }}>
          {Object.values(LEADERS).map((l) => (
            <div key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              {[20, 32, 64, 110].map((s) => <Crest key={s} motif={l.portrait.crest} colors={l.colors} size={s} />)}
              <Crest motif={l.portrait.crest} colors={l.colors} size={32} shape="round" />
              <Crest motif={l.portrait.crest} colors={l.colors} size={64} shape="round" />
            </div>
          ))}
        </div>
        <h3 style={h3}>procedural portraits · card / round / square</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          {Object.values(LEADERS).map((l) => (
            <figure key={l.id} style={{ margin: 0, display: 'grid', gap: 6, justifyItems: 'center' }}>
              <LeaderPortrait leader={l} size={160} procedural />
              <div style={{ display: 'flex', gap: 8 }}>
                <LeaderPortrait leader={l} size={56} shape="round" procedural />
                <LeaderPortrait leader={l} size={56} shape="square" procedural />
              </div>
              <figcaption style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text-dim)' }}>{l.name}</figcaption>
            </figure>
          ))}
        </div>
        <h3 style={h3}>with painted art (when ArtGen ships it)</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {Object.values(LEADERS).map((l) => <LeaderPortrait key={l.id} leader={l} size={120} />)}
        </div>
      </Section>
      <Section id="text" title="Rich text">
        <div style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
          {SAMPLES.map((t) => (
            <div key={t} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--glass)', border: '1px solid var(--glass-border)', fontSize: 15 }}>
              <RichText text={t} />
            </div>
          ))}
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(#f3e8cb, #e4d4ad)', color: '#3b2c16', fontSize: 13 }}>
            <RichText text={SAMPLES[1]} tone="light" />
          </div>
        </div>
      </Section>
    </div>
  );
}
