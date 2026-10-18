import fs from 'fs';
import path from 'path';
import { ALL_PERMISSION_CODES, PERMISSION_CATALOG } from '../src/shared/permissions/catalog';

const routesDir = path.resolve(__dirname, '..', 'src', 'routes');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (entry.isFile() && entry.name.endsWith('.ts')) return [full];
    return [];
  });
}

function main(): void {
  const files = walk(routesDir);
  const known = new Set(ALL_PERMISSION_CODES);
  const usedByModule = new Map<string, Set<string>>();
  const unknown: { file: string; code: string }[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.matchAll(/authorize\(\s*(['"])(?<code>[a-zA-Z0-9._-]+)\1/g);
    for (const match of matches) {
      const code = match.groups?.code;
      if (!code) continue;
      if (!known.has(code)) {
        unknown.push({ file: path.relative(process.cwd(), file), code });
        continue;
      }
      const module = PERMISSION_CATALOG.find((permission) => permission.code === code)!.module;
      if (!usedByModule.has(module)) usedByModule.set(module, new Set());
      usedByModule.get(module)!.add(code);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Permissions in catalog: ${ALL_PERMISSION_CODES.length}`);
  // eslint-disable-next-line no-console
  console.log(`Route files scanned: ${files.length}`);

  const unused = PERMISSION_CATALOG.filter(
    (permission) => !Array.from(usedByModule.values()).some((codes) => codes.has(permission.code)),
  );

  if (unknown.length > 0) {
    // eslint-disable-next-line no-console
    console.error('\nUnknown permission codes referenced in routes:');
    for (const entry of unknown) {
      // eslint-disable-next-line no-console
      console.error(`  - ${entry.code} (${entry.file})`);
    }
  }

  if (unused.length > 0) {
    // eslint-disable-next-line no-console
    console.warn('\nCatalog permissions not referenced by any route (may be enforced in services):');
    for (const permission of unused) {
      // eslint-disable-next-line no-console
      console.warn(`  - ${permission.code}`);
    }
  }

  if (unknown.length > 0) {
    process.exitCode = 1;
  } else {
    // eslint-disable-next-line no-console
    console.log('\nAll route permission codes are recognised by the catalog.');
  }
}

main();
