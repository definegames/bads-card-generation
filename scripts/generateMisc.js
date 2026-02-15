#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { resolveOutputPath, PROJECT_ROOT } = require('./utils/runtimeConfig');

const CANONICAL_BACKS_DIR = path.join(PROJECT_ROOT, 'images');
const MISC_BACK_FILES = [
	{ source: 'runway-deck-back.png', target: 'player-deck.png' },
	{ source: 'work-deck-back.png', target: 'work-deck.png' },
	{ source: 'goals-deck-back.png', target: 'goal-deck.png' },
	{ source: 'roles-deck-back.png', target: 'role-back.png' },
	{ source: 'keystones-deck-back.png', target: 'keystone-back.png' },
	{ source: 'milestones-deck-back.png', target: 'milestone-back.png' }
];

async function main() {
	const outputDir = resolveOutputPath('misc');
	await fs.mkdir(outputDir, { recursive: true });

	await Promise.all(
		MISC_BACK_FILES.map(async ({ source, target }) => {
			const sourcePath = path.join(CANONICAL_BACKS_DIR, source);
			const targetPath = path.join(outputDir, target);

			await fs.access(sourcePath);
			await fs.copyFile(sourcePath, targetPath);
		})
	);

	console.log(`Copied ${MISC_BACK_FILES.length} canonical misc card backs from ${CANONICAL_BACKS_DIR} to ${outputDir}`);
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to generate misc cards:', error);
		process.exitCode = 1;
	});
}
