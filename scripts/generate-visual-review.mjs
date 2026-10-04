import { writeFile } from 'node:fs/promises';
import { routes, languages, viewports } from './visual-matrix.mjs';
const cards = routes
  .map(
    ([name]) =>
      `<section><h2>${name}</h2><div>${languages
        .flatMap((language) =>
          viewports.map((v) => {
            const file = `${name}-${language}-${v.width}x${v.height}.png`;
            return `<figure><a href="baseline/${file}"><img loading="lazy" src="baseline/${file}" alt="${name} ${language} ${v.width}×${v.height}"></a><figcaption>${language} · ${v.width}×${v.height}</figcaption></figure>`;
          }),
        )
        .join('')}</div></section>`,
  )
  .join('\n');
await writeFile(
  'tests/visual/review.html',
  `<!doctype html><html lang="en"><meta charset="utf-8"><title>LegalMaster candidate visual baseline</title><style>body{font:16px system-ui;background:#f7f5ed;color:#18352f;margin:24px}section{margin:32px 0}section>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}figure{margin:0}img{width:100%;border:1px solid #aaa}figcaption{padding:8px}a{color:inherit}</style><h1>Candidate baseline — awaiting user approval</h1><p>64 fictional captures. Click any image for its full dimensions. Screenshot repeatability does not establish design approval. Original Stitch reference files are absent from this checkout.</p>${cards}</html>\n`,
);
