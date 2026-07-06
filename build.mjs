import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const JS_EXCLUDE = new Set([
  'modal-inline-head.js',
  'modal-prellenado.js',
  'supabase-config.js'
]);

const minify = (dir, ext, buildCmd) => {
  const files = readdirSync(dir).filter(f => f.endsWith(ext));
  for (const file of files) {
    if (ext === '.js' && JS_EXCLUDE.has(file)) continue;
    const fp = join(dir, file);
    const size = statSync(fp).size;
    try {
      execSync(buildCmd(fp), { stdio: 'pipe' });
      const newSize = statSync(fp).size;
      const saved = ((size - newSize) / 1024).toFixed(1);
      console.log(`  ${file}: ${(size/1024).toFixed(1)}K → ${(newSize/1024).toFixed(1)}K (${saved}K ahorrado)`);
    } catch (e) {
      console.error(`  ERROR: ${file} — ${e.message}`);
    }
  }
};

console.log('Minificando JS (excluyendo scripts pequeños)...');
minify('public/js', '.js',
  fp => `npx terser "${fp}" -o "${fp}" --compress --mangle`);

console.log('\nMinificando CSS...');
minify('public/css', '.css',
  fp => `npx cleancss -o "${fp}" "${fp}"`);

console.log('\n✓ Build completo');
