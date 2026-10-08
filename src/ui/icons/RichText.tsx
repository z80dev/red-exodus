// OWNER: Art2D. Rich text with inline icons, e.g. "+2 {food} on rivers · ×1.5 {splendor} if **Arts** is Focus".
// Syntax: `{food}` (any icon name) · `{icon:name}` (any name or content id) · `**bold**` · `\n` line breaks.
// Signed numbers render bold; a number directly followed by a yield/currency icon takes that icon's color,
// ×N multipliers take the Splendor color. Number+icon pairs never wrap apart.
// Yield and score tokens also print their plain name after the icon ("+1 {mandate}" → "+1 ♥ Life"), so new
// players never have to learn an icon to read a rule.
import { Fragment, useMemo, type ReactNode } from 'react';
import { Icon } from './Icon';
import { isIconName } from './registry';
import { T, YIELD_NAMES } from '../terms';
import './icons.css';

type Seg =
  | { t: 'text'; v: string }
  | { t: 'num'; v: string; mul: boolean; signed: boolean }
  | { t: 'icon'; name: string }
  | { t: 'bold'; c: Seg[] }
  | { t: 'br' };

/** icons whose color tints the number in front of them */
const TINTED: Record<string, true> = {
  food: true, prod: true, gold: true, sci: true, cul: true, happy: true, unhappy: true,
  influence: true, renown: true, splendor: true, mandate: true,
};

/** plain names printed after a token icon: [singular, plural] (singular after exactly "1") */
const TOKEN_WORDS: Record<string, readonly [string, string]> = {
  food: [YIELD_NAMES.food, YIELD_NAMES.food],
  prod: [YIELD_NAMES.prod, YIELD_NAMES.prod],
  gold: [YIELD_NAMES.gold, YIELD_NAMES.gold],
  sci: [YIELD_NAMES.sci, YIELD_NAMES.sci],
  cul: [YIELD_NAMES.cul, YIELD_NAMES.cul],
  happy: [T.happiness, T.happiness],
  unhappy: ['Unhappiness', 'Unhappiness'],
  influence: ['Coin', T.influence],
  renown: ['Point', T.renown],
  splendor: [T.splendor, T.splendor],
  mandate: ['Life', T.mandate],
};

function tokenWord(name: string, count?: string): string | null {
  const words = TOKEN_WORDS[name];
  if (!words) return null;
  return count && /^[+\-−]?1$/.test(count) ? words[0] : words[1];
}

const TOKEN = /\*\*(.+?)\*\*|\{icon:([^}\s]+)\}|\{([A-Za-z][\w-]*)\}|\n|(?<![\w.])([+\-−]|[×x](?=\d))?(\d+(?:[.,]\d+)?%?)(?![\w])/g;

function parse(text: string): Seg[] {
  const out: Seg[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index;
    if (at > last) out.push({ t: 'text', v: text.slice(last, at) });
    last = at + m[0].length;
    if (m[1] !== undefined) out.push({ t: 'bold', c: parse(m[1]) });
    else if (m[2] !== undefined) out.push({ t: 'icon', name: m[2] });
    else if (m[3] !== undefined) {
      if (isIconName(m[3])) out.push({ t: 'icon', name: m[3] });
      else out.push({ t: 'text', v: m[0] });
    } else if (m[0] === '\n') out.push({ t: 'br' });
    else {
      const sign = m[4] ?? '';
      const mul = sign === '×' || sign === 'x';
      out.push({ t: 'num', v: `${mul ? '×' : sign === '-' ? '−' : sign}${m[5]}`, mul, signed: sign !== '' });
    }
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

function render(segs: Seg[], iconSize: number | undefined, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const key = `${keyBase}${i}`;
    switch (seg.t) {
      case 'text':
        nodes.push(<Fragment key={key}>{seg.v}</Fragment>);
        break;
      case 'br':
        nodes.push(<br key={key} />);
        break;
      case 'bold':
        nodes.push(<b key={key}>{render(seg.c, iconSize, `${key}.`)}</b>);
        break;
      case 'icon': {
        const word = tokenWord(seg.name);
        nodes.push(word
          ? <span key={key} className="rt-glue"><Icon name={seg.name} size={iconSize} />{'\u202f'}{word}</span>
          : <Icon key={key} name={seg.name} size={iconSize} />);
        break;
      }
      case 'num': {
        // look ahead: "<num> {icon}" or "<num>{icon}" → glue + tint
        const gap = segs[i + 1];
        const hasGap = gap?.t === 'text' && /^ ?$/.test(gap.v);
        const next = hasGap ? segs[i + 2] : gap;
        const tint = next?.t === 'icon' && TINTED[next.name] ? next.name : null;
        const cls = ['rt-num', tint ? `rt-y-${tint}` : seg.mul ? 'rt-mul' : ''].filter(Boolean).join(' ');
        const num = seg.signed || tint ? <span className={cls}>{seg.v}</span> : seg.v;
        if (next?.t === 'icon') {
          const word = tokenWord(next.name, seg.v);
          nodes.push(
            <span key={key} className="rt-glue">
              {num}
              {hasGap ? '\u202f' : null}
              <Icon name={next.name} size={iconSize} />
              {word ? <span className={tint ? `rt-word rt-y-${tint}` : 'rt-word'}>{'\u202f'}{word}</span> : null}
            </span>,
          );
          i += hasGap ? 2 : 1;
        } else nodes.push(<Fragment key={key}>{num}</Fragment>);
        break;
      }
    }
  }
  return nodes;
}

export function RichText(props: { text: string; className?: string; iconSize?: number; /** 'light' on parchment surfaces */ tone?: 'dark' | 'light' }) {
  const { text, className, iconSize, tone } = props;
  const nodes = useMemo(() => render(parse(text), iconSize, ''), [text, iconSize]);
  const cls = ['aeons-rt', tone === 'light' ? 'aeons-rt--light' : '', className ?? ''].filter(Boolean).join(' ');
  return <span className={cls}>{nodes}</span>;
}
