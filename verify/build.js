// Loads every function module and runs the bundled ffmpeg, so a broken
// import or a missing binary fails here instead of in production.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { ffmpegPath } from '../lib/media.js';

const api = new URL('../api/', import.meta.url);
for (const file of readdirSync(api).filter((f) => f.endsWith('.js'))) {
  const mod = await import(new URL(file, api));
  if (typeof mod.default !== 'function') throw new Error(`api/${file} has no default export handler`);
}
const version = execFileSync(ffmpegPath(), ['-hide_banner', '-version']).toString().split('\n')[0];
const encoders = execFileSync(ffmpegPath(), ['-hide_banner', '-encoders']).toString();
if (!encoders.includes('libmp3lame')) throw new Error('ffmpeg has no libmp3lame encoder');
console.log(`build: ok (${version})`);
