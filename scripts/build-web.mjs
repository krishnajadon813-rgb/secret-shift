import { cp, mkdir, rm } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('../www/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL('../index.html', import.meta.url), new URL('index.html', output));
await cp(new URL('../client', import.meta.url), new URL('client', output), { recursive: true });
console.log('Web client copied to www/ for Android packaging.');
