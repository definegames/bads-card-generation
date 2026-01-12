#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas, loadImage } = require('canvas');
require('./utils/fontRegistry'); // Register fonts
const {
	CARD_SIZE,
	ROLE_CARD_WIDTH,
	ROLE_CARD_HEIGHT,
	TICKET_CARD_SIZE
} = require('./utils/constants');
const { resolveOutputPath, LOCALE } = require('./utils/runtimeConfig');

const ATLAS_COLUMNS = 10;
const ATLAS_ROWS = 7;
const CARDS_PER_ATLAS = ATLAS_COLUMNS * ATLAS_ROWS;
const FOUNDER_TITLE = 'The Founder';
const FOUNDER_FACE_FILE = `${sanitizeFileName(FOUNDER_TITLE)}.png`;
const FOUNDER_BACK_FILE = `back-${sanitizeFileName(FOUNDER_TITLE)}.png`;
const prioritizeFounderFace = createFilePriorityComparator(FOUNDER_FACE_FILE);
const prioritizeFounderBack = createFilePriorityComparator(FOUNDER_BACK_FILE);

const CARD_GROUPS = [
	{
		label: 'Milestone faces',
		prefix: 'milestone-faces',
		dir: resolveOutputPath('milestones'),
		filter: (name) => !name.startsWith('back-') && name.endsWith('.png'),
		cardWidth: CARD_SIZE,
		cardHeight: CARD_SIZE
	},
	{
		label: 'Keystone faces',
		prefix: 'keystone-faces',
		dir: resolveOutputPath('keystones'),
		filter: (name) => !name.startsWith('back-') && name.endsWith('.png'),
		cardWidth: CARD_SIZE,
		cardHeight: CARD_SIZE
	},
	{
		label: 'Feature faces',
		prefix: 'feature-faces',
		dir: resolveOutputPath('features'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: CARD_SIZE,
		cardHeight: CARD_SIZE
	},
	{
		label: 'Ability faces',
		prefix: 'ability-faces',
		dir: resolveOutputPath('abilities'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: CARD_SIZE,
		cardHeight: CARD_SIZE
	},
	{
		label: 'Role faces',
		prefix: 'role-faces',
		dir: resolveOutputPath('roles'),
		filter: (name) => name.endsWith('.png') && !name.startsWith('back-'),
		cardWidth: ROLE_CARD_WIDTH,
		cardHeight: ROLE_CARD_HEIGHT,
		sorter: prioritizeFounderFace
	},
	{
		label: 'Role backs',
		prefix: 'role-backs',
		dir: resolveOutputPath('roles'),
		filter: (name) => name.endsWith('.png') && name.startsWith('back-'),
		cardWidth: ROLE_CARD_WIDTH,
		cardHeight: ROLE_CARD_HEIGHT,
		sorter: prioritizeFounderBack
	},
	{
		label: 'Goal faces',
		prefix: 'goal-faces',
		dir: resolveOutputPath('goals'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: ROLE_CARD_WIDTH,
		cardHeight: ROLE_CARD_HEIGHT
	},
	{
		label: 'Ticket faces',
		prefix: 'ticket-faces',
		dir: resolveOutputPath('tickets'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: TICKET_CARD_SIZE,
		cardHeight: TICKET_CARD_SIZE
	},
	{
		label: 'Problem faces',
		prefix: 'problem-faces',
		dir: resolveOutputPath('problems'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: TICKET_CARD_SIZE,
		cardHeight: TICKET_CARD_SIZE
	}

];

async function main() {
	const atlasesDir = resolveOutputPath('atlases');
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
		const filtered = entries.filter(group.filter);
		if (typeof group.sorter === 'function') {
			return filtered.sort(group.sorter);
		}
		return filtered.sort();
	} catch (error) {
		if (error.code === 'ENOENT') {
			return [];
		}
		throw error;
	}
}

function createFilePriorityComparator(targetFile) {
	return (a, b) => {
		if (a === targetFile && b === targetFile) {
			return 0;
		}
		if (a === targetFile) {
			return -1;
		}
		if (b === targetFile) {
			return 1;
		}
		return a.localeCompare(b);
	};
}

function sanitizeFileName(value) {
	return value.replace(/[^a-z0-9._-]+/gi, '_');
}

async function buildAtlases({ prefix, cards, srcDir, destDir, cardWidth, cardHeight }) {
	if (!cards.length) {
		console.warn(`No cards found for ${prefix}, skipping.`);
		return;
	}

	const atlasCount = Math.ceil(cards.length / CARDS_PER_ATLAS);
	const localeTag = (LOCALE || 'default').toLowerCase();
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

		const cardCount = batch.length;
		const atlasName = `${prefix}-${String(atlasIndex + 1).padStart(2, '0')}-count-${cardCount}-${localeTag}.png`;
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
