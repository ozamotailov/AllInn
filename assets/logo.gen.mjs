import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const W = 640, H = 360;
const CREAM = '#f3ecda', GOLD = '#e7c25c', SPADE = '#16202b', HEART = '#d23b46';

const rect = (x, y, w, h, fill, rx = 2) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
const poly = (pts, fill) =>
  `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${fill}"/>`;

function letter(ch, x, y, w, h, t, fill) {
  const cx = x + w / 2;
  switch (ch) {
    case 'L':
      return rect(x, y, t, h, fill) + rect(x, y + h - t, w, t, fill);
    case 'I':
      return rect(cx - t / 2, y, t, h, fill);
    case 'N':
      return (
        rect(x, y, t, h, fill) +
        rect(x + w - t, y, t, h, fill) +
        poly([[x, y], [x + t, y], [x + w, y + h], [x + w - t, y + h]], fill)
      );
    case 'A':
      return (
        poly([[cx - t / 2, y], [cx + t / 2, y], [x + t, y + h], [x, y + h]], fill) +
        poly([[cx - t / 2, y], [cx + t / 2, y], [x + w, y + h], [x + w - t, y + h]], fill) +
        rect(x + w * 0.2, y + h * 0.58, w * 0.6, t * 0.9, fill)
      );
    default:
      return '';
  }
}

// Wordmark ALL·INN
const specs = [
  ['A', 50, CREAM], ['L', 42, CREAM], ['L', 42, CREAM],
  ['I', 26, GOLD], ['N', 50, GOLD], ['N', 50, GOLD],
];
const gap = 13, t = 13, h = 82;
const total = specs.reduce((s, [, w]) => s + w, 0) + gap * (specs.length - 1);
let lx = (W - total) / 2 - 108; // bias left (cards live on the right)
const wordCenter = lx + total / 2;
const wy = 122;
let word = '';
for (const [ch, w, fill] of specs) {
  word += letter(ch, lx, wy, w, h, t, fill);
  lx += w + gap;
}

const SPADE_PATH =
  'M50 8 C50 30 78 38 78 58 C78 72 66 78 58 72 C60 82 64 88 72 92 L28 92 C36 88 40 82 42 72 C34 78 22 72 22 58 C22 38 50 30 50 8 Z';
const HEART_PATH =
  'M50 86 C30 70 22 56 22 40 C22 26 34 20 42 28 C46 32 50 38 50 38 C50 38 54 32 58 28 C66 20 78 26 78 40 C78 56 70 70 50 86 Z';

function card(cx, cy, angle, path, color) {
  const cw = 96, ch = 134;
  const pip = (s, tx, ty) =>
    `<g transform="translate(${tx},${ty}) scale(${s})"><path d="${path}" fill="${color}"/></g>`;
  // Rank index "A" + a small suit pip in the corner (and mirrored to the opposite corner).
  const corner =
    letter('A', -cw / 2 + 9, -ch / 2 + 9, 18, 23, 5, color) + pip(0.16, -cw / 2 + 10, -ch / 2 + 35);
  return `<g transform="translate(${cx},${cy}) rotate(${angle})">
    <rect x="${-cw / 2 + 4}" y="${-ch / 2 + 7}" width="${cw}" height="${ch}" rx="12" fill="#000000" fill-opacity="0.22"/>
    <rect x="${-cw / 2}" y="${-ch / 2}" width="${cw}" height="${ch}" rx="12" fill="#fbfbf7" stroke="#d8d8cf"/>
    ${corner}
    <g transform="rotate(180)">${corner}</g>
    ${pip(0.92, -46, -47)}
  </g>`;
}

function chip(cx, cy, fill) {
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="27" fill="${fill}" stroke="#00000033" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="19" fill="none" stroke="#ffffffcc" stroke-width="3" stroke-dasharray="6 7"/>
  </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="felt" cx="46%" cy="34%" r="85%">
      <stop offset="0%" stop-color="#1d7d50"/>
      <stop offset="58%" stop-color="#115f3b"/>
      <stop offset="100%" stop-color="#072d1c"/>
    </radialGradient>
    <radialGradient id="vig" cx="50%" cy="42%" r="75%">
      <stop offset="60%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.38"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#felt)"/>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="18" fill="none" stroke="#e7c25c" stroke-opacity="0.32" stroke-width="2"/>

  ${card(476, 126, -9, HEART_PATH, HEART)}
  ${card(552, 144, 10, SPADE_PATH, SPADE)}

  ${word}

  ${chip(96, 286, '#c9433f')}
  ${chip(150, 286, '#2f6fb0')}
  ${chip(123, 263, '#e7c25c')}

  <!-- spade accent centered under the wordmark -->
  <g transform="translate(${wordCenter - 9},212) scale(0.4)"><path d="${SPADE_PATH}" fill="#e7c25c" fill-opacity="0.9"/></g>
</svg>`;

writeFileSync('/tmp/imgtool/allinn.svg', svg);
await sharp(Buffer.from(svg)).png().toFile('/tmp/imgtool/allinn.png');
console.log('done');
