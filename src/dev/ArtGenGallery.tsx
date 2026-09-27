// Gallery of every shipped painted illustration (src/ui/art/artManifest.ts). Open with ?dev=ArtGenGallery.
// Cards are shown inside a gold frame at in-game sizes so the ink vignette / frame fit can be judged.
import { useState } from 'react';
import { ART_KINDS, ART_LIST, ART_SIZE, type ArtKind } from '../ui/art/artManifest';

const BACKDROP: Record<ArtKind, boolean> = {
  leaders: false, doctrines: false, edicts: false, crises: false, omens: false, reforms: false, eras: true, key: true,
};

export default function ArtGenGallery() {
  const [kind, setKind] = useState<ArtKind>('doctrines');
  const [zoom, setZoom] = useState<string | null>(null);
  const items = ART_LIST.filter((e) => e.kind === kind);
  const { w, h } = ART_SIZE[kind];
  const cellW = BACKDROP[kind] ? 320 : kind === 'leaders' ? 168 : 132;

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'auto', background: 'var(--ink-950)', color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 2, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
        padding: 'calc(10px + var(--safe-top)) 12px 10px', background: 'var(--glass-strong)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--glass-border)',
      }}>
        <h1 style={{ margin: '0 10px 0 0', fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--gold-400)' }}>Illustrations</h1>
        {ART_KINDS.map((k) => {
          const n = ART_LIST.filter((e) => e.kind === k).length;
          return (
            <button key={k} onClick={() => setKind(k)} style={{
              minHeight: 36, padding: '0 12px', borderRadius: 999, cursor: 'pointer', fontSize: 13,
              border: `1px solid ${k === kind ? 'var(--gold-500)' : 'var(--glass-border)'}`,
              background: k === kind ? 'var(--gold-700)' : 'transparent', color: k === kind ? 'var(--parchment)' : 'var(--text-dim)',
            }}>{k} <span style={{ opacity: 0.7 }}>{n}</span></button>
          );
        })}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-faint)' }}>{w}×{h} webp</span>
      </header>

      <main style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${cellW}px, 1fr))`, gap: 14, padding: 14 }}>
        {items.length === 0 && <p style={{ color: 'var(--text-dim)' }}>No {kind} illustrations shipped yet.</p>}
        {items.map((e) => (
          <figure key={e.id} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => setZoom(e.src)} style={{
              padding: 0, cursor: 'zoom-in', aspectRatio: `${w} / ${h}`, overflow: 'hidden', background: 'var(--ink-900)',
              borderRadius: BACKDROP[kind] ? 8 : 10, border: '2px solid var(--gold-500)',
              boxShadow: 'inset 0 0 0 1px var(--gold-700), 0 0 0 1px #000, var(--shadow)',
            }}>
              <img src={e.src} alt={e.id} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
            {e.portrait && (
              <button onClick={() => setZoom(e.portrait)} style={{
                alignSelf: 'center', width: '40%', padding: 0, aspectRatio: `${h} / ${w}`, overflow: 'hidden', cursor: 'zoom-in',
                borderRadius: 8, border: '2px solid var(--gold-600)', background: 'var(--ink-900)',
              }}>
                <img src={e.portrait} alt={`${e.id} portrait`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            )}
            <figcaption style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', wordBreak: 'break-all' }}>{e.id}</figcaption>
          </figure>
        ))}
      </main>

      {zoom && (
        <div onClick={() => setZoom(null)} style={{
          position: 'fixed', inset: 0, zIndex: 5, display: 'grid', placeItems: 'center', padding: 16,
          background: 'rgba(5,8,15,0.9)', cursor: 'zoom-out',
        }}>
          <img src={zoom} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 10, border: '2px solid var(--gold-500)' }} />
        </div>
      )}
    </div>
  );
}
