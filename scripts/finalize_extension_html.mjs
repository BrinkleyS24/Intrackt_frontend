import fs from 'node:fs';
import path from 'node:path';

// Parcel emits shared chunks at the bundle root, while extension entry HTML lives
// two directories below it. Resolve both entry tags and lazy import-map chunks.
const dist = path.resolve(process.argv[2] || process.env.DIST_DIR || 'popup/dist');
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
  html = html.replace(/(<script\b[^>]*\btype=(?:"importmap"|'importmap'|importmap)[^>]*>)([\s\S]*?)(<\/script>)/g,
    (_match, start, body, end) => {
      const map = JSON.parse(body);
      for (const key of Object.keys(map.imports || {})) map.imports[key] = resolveAsset(map.imports[key]);
      return start + JSON.stringify(map) + end;
    });
  fs.writeFileSync(file, html);
}
