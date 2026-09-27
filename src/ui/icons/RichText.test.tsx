import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RichText } from './RichText';

const html = (text: string) => renderToStaticMarkup(<RichText text={text} />);
const icons = (markup: string) => markup.match(/<svg/g)?.length ?? 0;

describe('RichText', () => {
  it('renders yield tokens and {icon:id} as inline icons, leaving unknown tokens as text', () => {
    const out = html('+2 {food} on rivers, {icon:bld_workshop} and {notAnIcon}');
    expect(icons(out)).toBe(2);
    expect(out).toContain('{notAnIcon}');
  });

  it('tints a number with the color of the yield icon right after it and keeps them together', () => {
    const out = html('Gain +3 {sci} now');
    expect(out).toMatch(/<span class="rt-glue"><span class="rt-num rt-y-sci">\+3<\/span>/);
  });

  it('colors multipliers as Splendor and normalizes x/hyphen signs', () => {
    expect(html('x1.5 splendor')).toContain('<span class="rt-num rt-mul">×1.5</span>');
    expect(html('lose -1 each')).toContain('<span class="rt-num">−1</span>');
  });

  it('leaves unsigned standalone numbers and digits inside words plain', () => {
    const out = html('Era2 has 36 techs');
    expect(out).not.toContain('rt-num');
    expect(out).toContain('Era2 has 36 techs');
  });

  it('parses **bold** with icons inside and \\n line breaks', () => {
    const out = html('**+1 {gold} Tax**\nnext');
    expect(out).toMatch(/<b>.*rt-y-gold.*Tax<\/b><br\/>next/);
  });
});
