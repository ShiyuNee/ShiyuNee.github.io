// Reproducible, dependency-free SVG charts. Run with: node _scripts/render-research-charts.mjs
// Values and their provenance live in _data/research_charts.json; no chart values are inferred from pixels.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const charts = JSON.parse(fs.readFileSync(path.join(root, '_data/research_charts.json'), 'utf8'));
const out = path.join(root, 'images/research/charts');
fs.mkdirSync(out, { recursive: true });
const C = { ink: '#182e3b', muted: '#647784', grid: '#e2e9ed', blue: '#2872b8', red: '#d5645e', teal: '#20887f' };
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const t = (x, y, value, size = 18, attrs = '') => `<text x="${x}" y="${y}" font-size="${size}" ${attrs}>${esc(value)}</text>`;
const line = (x1, y1, x2, y2, attrs = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attrs}/>`;
const rect = (x, y, width, height, attrs = '') => `<rect x="${x}" y="${y}" width="${width}" height="${height}" ${attrs}/>`;
const circle = (cx, cy, r, attrs = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" ${attrs}/>`;

function frame(id, c, body) {
  const description = `${c.subtitle}. ${c.metric}. ${c.source}. ${c.footnotes.join(' ')} Data: ${JSON.stringify(c.data)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="660" viewBox="0 0 1080 660" role="img" aria-labelledby="${id}-title ${id}-desc">
<title id="${id}-title">${esc(c.title)}</title><desc id="${id}-desc">${esc(description)}</desc>
<style>text{font-family:Arial,Helvetica,sans-serif;fill:${C.ink};font-variant-numeric:tabular-nums} .muted{fill:${C.muted}} .grid{stroke:${C.grid};stroke-width:1} .axis{stroke:#a8b8c2;stroke-width:1.2}</style>
${rect(0, 0, 1080, 660, 'fill="#fff"')}
${t(38, 35, c.eyebrow.toUpperCase(), 13, `class="muted" letter-spacing="1.6"`)}
${t(38, 79, c.title, c.title.length > 53 ? 29 : 32, 'font-weight="700"')}
${t(38, 113, c.subtitle, 17, 'class="muted"')}
${body}
${line(38, 567, 1042, 567, 'class="grid"')}
${t(38, 591, c.source, 14, 'font-weight="600"')}
${c.footnotes.map((s, i) => t(38, 615 + i * 21, s, 13.5, 'class="muted"')).join('')}
</svg>`;
}

function bars(c) {
  const left = 80, right = 1042, top = 214, bottom = 471;
  const scale = v => bottom - v / c.maximum * (bottom - top);
  const band = (right - left) / c.data.length;
  const width = c.data.length <= 3 ? 52 : 40;
  const gap = c.data.length <= 3 ? 8 : 16;
  let body = t(left, 194, c.metric, 16, 'class="muted"');
  let lx = 38;
  for (const s of c.series) {
    body += rect(lx, 141, 16, 16, `rx="3" fill="${s.color}"`);
    body += t(lx + 25, 155, s.label, 17);
    lx += s.label.length * 9 + 65;
  }
  for (const tick of c.ticks) {
    const y = scale(tick);
    body += line(left, y, right, y, tick === 0 ? 'class="axis"' : 'class="grid"');
    body += t(left - 13, y + 5, c.maximum < 1 ? tick.toFixed(1) : tick, 15, 'text-anchor="end" class="muted"');
  }
  c.data.forEach((d, i) => {
    const x = left + band * (i + 0.5);
    c.series.forEach((s, j) => {
      const value = d[s.key];
      if (!Number.isFinite(value) || value < 0 || value > c.maximum) throw Error(`Invalid bar value for ${d.label}/${s.key}`);
      const bx = x + (j - .5) * (width + gap) - width / 2;
      body += rect(bx, scale(value), width, bottom - scale(value), `rx="3" fill="${s.color}"`);
      body += t(bx + width / 2, scale(value) - 10, value.toFixed(c.precision), 17, `text-anchor="middle" font-weight="600" style="fill:${s.color}"`);
    });
    body += t(x, 502, d.label, c.data.length > 4 ? 17 : 19, 'text-anchor="middle" font-weight="600"');
    if (Number.isFinite(d.gap)) body += t(x, 535, `Gap +${d.gap.toFixed(1)} pp`, 16, `text-anchor="middle" style="fill:${C.red}"`);
  });
  if (c.summary) body += t(80, 542, c.summary, 19, `font-weight="600" style="fill:${C.teal}"`);
  return body;
}

function dots(c) {
  const cols = [{ x: 298, width: 310 }, { x: 710, width: 310 }];
  const ys = [250, 344, 438];
  let body = t(38, 154, c.metric, 16, 'class="muted"');
  body += rect(27, 306, 1024, 77, 'rx="8" fill="#eff8f5"');
  c.data.forEach((d, row) => {
    body += t(38, ys[row] - 4, d.label, 21, `font-weight="700" style="fill:${d.color}"`);
    body += t(38, ys[row] + 20, d.sub_label, 16, 'class="muted"');
  });
  c.columns.forEach((column, index) => {
    const { x, width } = cols[index];
    const sx = v => x + (v - c.minimum) / (c.maximum - c.minimum) * width;
    body += t(x, 197, column.label, 19, 'font-weight="600"');
    c.ticks.forEach(tick => {
      body += line(sx(tick), 214, sx(tick), 470, 'class="grid"');
      body += t(sx(tick), 498, tick, 15, 'text-anchor="middle" class="muted"');
    });
    c.data.forEach((d, row) => {
      const value = d[column.key];
      if (!Number.isFinite(value) || value < c.minimum || value > c.maximum) throw Error('Dot out of range');
      body += line(x, ys[row], sx(value), ys[row], `stroke="${d.color}" stroke-opacity=".25" stroke-width="3"`);
      body += circle(sx(value), ys[row], 7.5, `fill="${d.color}" stroke="#fff" stroke-width="2"`);
      body += t(sx(value) + 14, ys[row] + 6, value.toFixed(c.precision), 18, `font-weight="600" style="fill:${d.color}"`);
    });
  });
  return body;
}

function heatmap(c) {
  let body = t(38, 154, c.metric, 16, 'class="muted"');
  const start = 293, cellWidth = 239, cellHeight = 72, rowGap = 17, columnGap = 13;
  const blend = value => {
    const target = value < 0 ? [40, 114, 184] : [213, 100, 94];
    return `rgb(${target.map(v => Math.round(255 + (v - 255) * Math.abs(value))).join(',')})`;
  };
  c.columns.forEach((col, i) => { body += t(start + i * (cellWidth + columnGap) + cellWidth / 2, 197, col.label, 20, 'text-anchor="middle" font-weight="600"'); });
  c.data.forEach((row, ri) => {
    const y = 219 + ri * (cellHeight + rowGap);
    body += t(38, y + (row.sub_label ? 31 : 44), row.label, 21, 'font-weight="600"');
    if (row.sub_label) body += t(38, y + 55, row.sub_label, 15, 'class="muted"');
    c.columns.forEach((col, ci) => {
      const value = row[col.key];
      if (!Number.isFinite(value) || Math.abs(value) > 1) throw Error('Invalid correlation');
      const x = start + ci * (cellWidth + columnGap);
      body += rect(x, y, cellWidth, cellHeight, `rx="6" fill="${blend(value)}" stroke="#e9eef0"`);
      body += t(x + cellWidth / 2, y + 46, (value > 0 ? '+' : '') + value.toFixed(3), 28, 'text-anchor="middle" font-weight="600"');
    });
  });
  body += '<defs><linearGradient id="correlation-ramp"><stop offset="0%" stop-color="#2872b8"/><stop offset="50%" stop-color="#ffffff"/><stop offset="100%" stop-color="#d5645e"/></linearGradient></defs>';
  body += rect(294, 512, 364, 12, 'fill="url(#correlation-ramp)" stroke="#dde5e9"');
  body += t(294, 546, '−1', 15, 'text-anchor="middle" class="muted"');
  body += t(476, 546, '0', 15, 'text-anchor="middle" class="muted"');
  body += t(658, 546, '+1', 15, 'text-anchor="middle" class="muted"');
  body += t(697, 525, 'Association, not a causal effect', 16, 'class="muted"');
  return body;
}

for (const [id, c] of Object.entries(charts)) {
  if (id === 'retrieval') c.data.forEach(d => {
    d.certain = Number((100 * (1 - d.uncertain_rate)).toFixed(2));
    d.gap = Number((d.certain - d.accuracy).toFixed(2));
  });
  const body = c.kind === 'dots' ? dots(c) : c.kind === 'heatmap' ? heatmap(c) : bars(c);
  fs.writeFileSync(path.join(out, `${id}.svg`), frame(id, c, body));
  fs.writeFileSync(path.join(out, `${id}.json`), JSON.stringify(c, null, 2) + '\n');
  const keys = [...new Set(c.data.flatMap(row => Object.keys(row)))].filter(key => key !== 'color');
  const quote = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  fs.writeFileSync(path.join(out, `${id}.csv`), [keys, ...c.data.map(row => keys.map(k => row[k]))].map(row => row.map(quote).join(',')).join('\n') + '\n');
  console.log(`Rendered ${id}: ${c.data.length} rows; source: ${c.source}`);
}
