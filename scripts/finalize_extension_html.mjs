import fs from 'node:fs';
import path from 'node:path';

// Parcel emits shared chunks at the bundle root, while extension entry HTML lives
// two directories below it. Resolve both entry tags and lazy import-map chunks.
const dist = path.resolve(process.argv[2] || process.env.DIST_DIR || 'popup/dist');
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const entry of ['popup/public/index.html', 'testing/public/index.html']) {
  const file = path.join(dist, entry);
  if (!fs.existsSync(file)) continue;
  const resolveAsset = value => {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(value)) return value;
    if (fs.existsSync(path.resolve(path.dirname(file), value))) return value;
    const rootAsset = path.resolve(dist, value);
    if (!rootAsset.startsWith(dist + path.sep) || !fs.existsSync(rootAsset)) {
      throw new Error(`Missing bundled asset in ${entry}: ${value}`);
    }
    return path.relative(path.dirname(file), rootAsset).replaceAll('\\', '/');
  };
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/\b(src|href)=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/g,
    (_match, attr, double, single, bare) => `${attr}="${resolveAsset(double || single || bare)}"`);
  html = html.replace(/<script\b[^>]*\btype=(?:"importmap"|'importmap'|importmap)[^>]*>([\s\S]*?)<\/script>/g,
    (_match, body) => {
      const map = JSON.parse(body);
      const bundledScripts = fs.readdirSync(dist)
        .filter(name => name.endsWith('.js'))
        .map(name => fs.readFileSync(path.join(dist, name), 'utf8'));
      for (const [specifier, asset] of Object.entries(map.imports || {})) {
        const resolved = resolveAsset(asset);
        const fileName = path.basename(resolved);
        const parcelMapping = new RegExp(`(?:["'])?${escapeRegex(specifier)}(?:["'])?\\s*:\\s*["']${escapeRegex(fileName)}["']`);
        if (!bundledScripts.some(script => parcelMapping.test(script))) {
          throw new Error(`Cannot remove CSP-blocked import map: ${specifier} has no Parcel runtime mapping to ${fileName}.`);
        }
      }
      // MV3 blocks inline import maps. Parcel also embeds these chunk mappings in
      // its runtime, so the map is redundant once every entry is confirmed above.
      return '';
    });
  fs.writeFileSync(file, html);
}
