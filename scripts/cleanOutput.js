#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { OUTPUT_ROOT } = require('./utils/runtimeConfig');

async function main() {
	if (!OUTPUT_ROOT) {
		throw new Error('OUTPUT_ROOT is not defined; cannot perform cleanup.');
	}

	const normalizedRoot = path.resolve(OUTPUT_ROOT);
	await fs.rm(normalizedRoot, { recursive: true, force: true });
	await fs.mkdir(normalizedRoot, { recursive: true });
	console.log(`Cleaned output root at ${normalizedRoot}`);
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to clean output root:', error);
		process.exitCode = 1;
	});
}
