import { readFile, writeFile } from 'node:fs/promises';
const source = new URL('../../docs/6. TPS details description.md', import.meta.url);
const target = new URL('../src/content/background.md', import.meta.url);
const markdown = await readFile(source, 'utf8');
await writeFile(target, markdown.replace(/^# .+\r?\n+\*\*Updated .+?\*\*\r?\n+/, '').replace(/\\br/g, '  \n'));
console.log('Updated website background from docs/6. TPS details description.md');
