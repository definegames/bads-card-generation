#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');

const PAIRS = [
	{ src: '../outputs/atlases', dest: '../public/atlases' },
	{ src: '../outputs/misc', dest: '../public/misc' }
];

async function main() {
	await Promise.all(
		PAIRS.map(async ({ src, dest }) => {
			const absoluteSrc = path.resolve(__dirname, src);
			const absoluteDest = path.resolve(__dirname, dest);
			await copyDirectory(absoluteSrc, absoluteDest);
		})
	);

	console.log('Synced static atlases and misc assets into /public.');
}

async function copyDirectory(src, dest) {
	try {
		await fs.access(src);
	} catch (error) {
		if (error.code === 'ENOENT') {
			console.warn(`Source directory not found: ${src}. Skipping.`);
			return;
		}
		throw error;
	}

	await fs.rm(dest, { recursive: true, force: true });
	await fs.mkdir(dest, { recursive: true });

	await fs.cp(src, dest, { recursive: true });
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to sync static assets:', error);
		process.exitCode = 1;
	});
}
