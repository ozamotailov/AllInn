import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const S = 512, C = S / 2;
const CREAM = '#f3ecda', GOLD = '#e7c25c', SPADE = '#16202b', FELT = '#0f5a37';
const SPADE_PATH =
  'M50 8 C50 30 78 38 78 58 C78 72 66 78 58 72 C60 82 64 88 72 92 L28 92 C36 88 40 82 42 72 C34 78 22 72 22 58 C22 38 50 30 50 8 Z';

// 6 edge spots around the chip rim
let spots = '';
for (let a = 0; a < 360; a += 60) {
  spots += `<g transform="rotate(${a},${C},${C})"><rect x="${C - 20}" y="${C - 182}" width="40" height="54" rx="12" fill="${CREAM}"/></g>`;
}

// Center spade
const sc = 1.62;
const tx = C - 50 * sc;
const spade = `<g transform="translate(${tx},${tx})"><path d="${SPADE_PATH}" transform="scale(${sc})" fill="${SPADE}"/></g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="felt" cx="42%" cy="34%" r="85%">
      <stop offset="0%" stop-color="#1d7d50"/>
      <stop offset="60%" stop-color="#115f3b"/>
      <stop offset="100%" stop-color="#072d1c"/>
    </radialGradient>
    <radialGradient id="vig" cx="50%" cy="42%" r="72%">
      <stop offset="62%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.4"/>
    </radialGradient>
  </defs>
  <rect width="${S}" height="${S}" rx="96" fill="url(#felt)"/>
  <rect width="${S}" height="${S}" rx="96" fill="url(#vig)"/>
  <rect x="14" y="14" width="${S - 28}" height="${S - 28}" rx="84" fill="none" stroke="${GOLD}" stroke-opacity="0.30" stroke-width="3"/>

  <!-- chip -->
  <circle cx="${C}" cy="${C + 7}" r="186" fill="#000" fill-opacity="0.25"/>
  <circle cx="${C}" cy="${C}" r="182" fill="${GOLD}"/>
  ${spots}
  <circle cx="${C}" cy="${C}" r="130" fill="${CREAM}"/>
  <circle cx="${C}" cy="${C}" r="130" fill="none" stroke="${FELT}" stroke-width="10"/>
  ${spade}
</svg>`;

writeFileSync('/tmp/imgtool/icon.svg', svg);
await sharp(Buffer.from(svg)).png().toFile('/tmp/imgtool/icon.png');
console.log('done');
