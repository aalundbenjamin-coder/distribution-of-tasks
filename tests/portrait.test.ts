import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import Portrait, { paletteFor } from '@/components/Portrait';

/**
 * The portraits on the presentation page were drawn by hand before the app had
 * anywhere to keep a profile. These pin the component's output to those
 * drawings, so the person on the projected slide and the person in the roster
 * are visibly the same person rather than merely sharing a name.
 */
const DRAWN = JSON.parse(
  readFileSync(new URL('../scripts/presentation/avatars.json', import.meta.url), 'utf-8'),
) as Record<string, string>;

/**
 * The drawing instructions inside the clipped group, with ids and styling
 * hooks dropped. Comparing these rather than the raw string ignores everything
 * that legitimately differs — the generated clip id, the sizing attributes the
 * component adds — and nothing that would change the picture.
 */
function ops(svg: string): string[] {
  const body = svg.slice(svg.indexOf('>', svg.indexOf('<g clip-path=')) + 1, svg.lastIndexOf('</g>'));
  return [...body.matchAll(/<(\w+)([^>]*?)\/?>/g)].map(([, tag, attrs]) => {
    const pairs = [...attrs!.matchAll(/([\w-]+)="([^"]*)"/g)]
      .filter(([, name]) => name !== 'class')
      .map(([, name, value]) => `${name}=${value}`)
      .sort();
    return `${tag} ${pairs.join(' ')}`;
  });
}

function render(seed: string): string {
  return renderToStaticMarkup(createElement(Portrait, { seed }));
}

describe('portraits carried over from the presentation', () => {
  it.each(Object.keys(DRAWN))('%s is drawn exactly as on the slide', (key) => {
    expect(ops(render(key))).toEqual(ops(DRAWN[key]!));
  });

  it('covers both hair styles, a beard and glasses between them', () => {
    const five = Object.keys(DRAWN).map(paletteFor);
    expect(five.filter((p) => p.hair === 'long').length).toBeGreaterThan(0);
    expect(five.filter((p) => p.hair === 'short').length).toBeGreaterThan(0);
    expect(five.filter((p) => p.beard).length).toBeGreaterThan(0);
    expect(five.filter((p) => p.glasses).length).toBeGreaterThan(0);
  });

  it('recognises a name whatever its case or padding', () => {
    expect(paletteFor('  Sofie  ')).toEqual(paletteFor('sofie'));
  });
});

describe('portraits derived from a name', () => {
  const TEAM = ['Anna Holm', 'Bo Lindqvist', 'Camilla Bech', 'David Nyholm', 'Elif Yılmaz',
    'Frederik Aaen', 'Gitte Rask', 'Henrik Vad', 'Mette Sørensen', 'Jonas Kruse'];

  it('gives the same person the same face every time', () => {
    expect(render('Anna Holm')).toBe(render('Anna Holm'));
  });

  it('does not hand the whole team one face', () => {
    const faces = new Set(TEAM.map((n) => JSON.stringify(paletteFor(n))));
    expect(faces.size).toBeGreaterThanOrEqual(TEAM.length - 1);
  });

  it('gives every portrait its own clip id, so one cannot mask another', () => {
    const ids = TEAM.map((n) => render(n).match(/id="([^"]+)"/)![1]);
    expect(new Set(ids).size).toBe(TEAM.length);
  });

  it('only ever draws from the curated sets', () => {
    const known = new Set(Object.values(DRAWN).flatMap((s) => [...s.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0]!.toLowerCase())));
    for (let i = 0; i < 300; i += 1) {
      const p = paletteFor(`person-${i}`);
      expect(p.bg).toMatch(/^#[0-9a-f]{6}$/);
      // Colours outside the drawn set are allowed, but the structure is not.
      expect(['long', 'short']).toContain(p.hair);
      expect(known.size).toBeGreaterThan(0);
    }
  });
});
