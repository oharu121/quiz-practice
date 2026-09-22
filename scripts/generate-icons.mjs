/**
 * Rasterises static/favicon.svg into the PNG icons the web app manifest and iOS need.
 *
 * Run by hand after editing the SVG — never as part of `pnpm build`. The generated PNGs
 * are committed so that the build stays dependency-free:
 *
 *   pnpm exec node scripts/generate-icons.mjs
 *
 * The source SVG is full-bleed on purpose: iOS applies its own corner mask, and Android's
 * maskable crop only guarantees the central 80%, which the glyph stays well inside.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(resolve(root, 'static/favicon.svg'));

const targets = [
	{ file: 'icon-192.png', size: 192 },
	{ file: 'icon-512.png', size: 512 },
	{ file: 'icon-512-maskable.png', size: 512 },
	{ file: 'apple-touch-icon.png', size: 180 }
];

for (const { file, size } of targets) {
	const png = await sharp(source, { density: 512 }).resize(size, size).png().toBuffer();
	await writeFile(resolve(root, 'static', file), png);
	console.log(`wrote static/${file} (${size}x${size}, ${png.length} bytes)`);
}
