#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas, loadImage } = require('canvas');
const { CARD_SIZE, ROLE_CARD_WIDTH, ROLE_CARD_HEIGHT } = require('./utils/constants');

const ATLAS_COLUMNS = 10;
const ATLAS_ROWS = 7;
const CARDS_PER_ATLAS = ATLAS_COLUMNS * ATLAS_ROWS;

const CARD_GROUPS = [
	{
		label: 'Milestone faces',
		prefix: 'milestone-faces',
		dir: path.resolve(__dirname, '../outputs/milestones'),
		filter: (name) => !name.startsWith('back-') && name.endsWith('.png'),
		cardWidth: CARD_SIZE,
		cardHeight: CARD_SIZE
	},
	{
		label: 'Milestone backs',
		prefix: 'milestone-backs',
		dir: path.resolve(__dirname, '../outputs/milestones'),
		filter: (name) => name.startsWith('back-') && name.endsWith('.png'),
		cardWidth: CARD_SIZE,
		cardHeight: CARD_SIZE
	},
	{
		label: 'Feature faces',
		prefix: 'feature-faces',
		dir: path.resolve(__dirname, '../outputs/features'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: CARD_SIZE,
		cardHeight: CARD_SIZE
	},
	{
		label: 'Ability faces',
		prefix: 'ability-faces',
		dir: path.resolve(__dirname, '../outputs/abilities'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: CARD_SIZE,
		cardHeight: CARD_SIZE
	},
	{
		label: 'Role faces',
		prefix: 'role-faces',
		dir: path.resolve(__dirname, '../outputs/roles'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: ROLE_CARD_WIDTH,
		cardHeight: ROLE_CARD_HEIGHT
	}

];

async function main() {
	const atlasesDir = path.resolve(__dirname, '../outputs/atlases');
	await fs.mkdir(atlasesDir, { recursive: true });

	await Promise.all(
		CARD_GROUPS.map(async (group) => {
			const cards = await readCards(group);
			if (!cards.length) {
				console.warn(`No cards found for ${group.label}, skipping.`);
				return;
			}
			await buildAtlases({
				prefix: group.prefix,
				cards,
				srcDir: group.dir,
				destDir: atlasesDir,
				cardWidth: group.cardWidth ?? CARD_SIZE,
				cardHeight: group.cardHeight ?? CARD_SIZE
			});
		})
	);
}

async function readCards(group) {
	try {
		const entries = await fs.readdir(group.dir);
		return entries.filter(group.filter).sort();
	} catch (error) {
		if (error.code === 'ENOENT') {
			return [];
		}
		throw error;
	}
}

async function buildAtlases({ prefix, cards, srcDir, destDir, cardWidth, cardHeight }) {
	if (!cards.length) {
		console.warn(`No cards found for ${prefix}, skipping.`);
		return;
	}

	const atlasCount = Math.ceil(cards.length / CARDS_PER_ATLAS);
	for (let atlasIndex = 0; atlasIndex < atlasCount; atlasIndex++) {
		const sliceStart = atlasIndex * CARDS_PER_ATLAS;
		const sliceEnd = sliceStart + CARDS_PER_ATLAS;
		const batch = cards.slice(sliceStart, sliceEnd);

		const canvas = createCanvas(cardWidth * ATLAS_COLUMNS, cardHeight * ATLAS_ROWS);
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		await Promise.all(
			batch.map(async (fileName, index) => {
				const image = await loadImage(path.join(srcDir, fileName));
				const col = index % ATLAS_COLUMNS;
				const row = Math.floor(index / ATLAS_COLUMNS);
				ctx.drawImage(image, col * cardWidth, row * cardHeight, cardWidth, cardHeight);
			})
		);

		const atlasName = `${prefix}-${String(atlasIndex + 1).padStart(2, '0')}.png`;
		const atlasPath = path.join(destDir, atlasName);
		await fs.writeFile(atlasPath, canvas.toBuffer('image/png'));
		console.log(`Saved ${atlasName} with ${batch.length} cards.`);
	}
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to build atlases:', error);
		process.exitCode = 1;
	});
}
