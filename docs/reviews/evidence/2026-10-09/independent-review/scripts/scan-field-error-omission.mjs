/* global console */
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk('src').filter((f) => f.endsWith('.tsx') && !/\.test\.|\/test\//.test(f));
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  if (!/forms\/FormField|from '\.\/FormField'/.test(src)) continue;
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rows = [];
  const visit = (n) => {
    if (ts.isJsxElement(n) && n.openingElement.tagName.getText() === 'Field') {
      const attrs = n.openingElement.attributes.properties.map((a) => a.name?.getText());
      const hasErr = attrs.includes('error');
      const childText = n.children.map((c) => c.getText()).join('');
      const childRequired = /\brequired\b/.test(childText.replace(/aria-required/g, ''));
      const fieldRequired = attrs.includes('required');
      const hasZodInvalid = /formState\.errors|aria-invalid/.test(childText);
      const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
      if (!hasErr && (fieldRequired || childRequired || hasZodInvalid))
        rows.push(
          `${path.relative('.', f)}:${line} Field required=${fieldRequired} childRequired=${childRequired} childHasOwnAriaInvalid=${hasZodInvalid}`,
        );
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  rows.forEach((r) => console.log(r));
}
