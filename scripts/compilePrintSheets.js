#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const { createCanvas, loadImage } = require('canvas');
require('./utils/fontRegistry'); // Register fonts
const PDFDocument = require('pdfkit');
const { CARD_SIZE, ROLE_CARD_WIDTH, ROLE_CARD_HEIGHT, TICKET_CARD_SIZE } = require('./utils/constants');
const { resolveOutputPath, LOCALE } = require('./utils/runtimeConfig');

const PRINT_DPI = 300;
const MM_PER_INCH = 25.4;
const POINTS_PER_INCH = 72;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

const A4_WIDTH_PX = Math.round((A4_WIDTH_MM / MM_PER_INCH) * PRINT_DPI);
const A4_HEIGHT_PX = Math.round((A4_HEIGHT_MM / MM_PER_INCH) * PRINT_DPI);
const A4_WIDTH_PT = (A4_WIDTH_MM / MM_PER_INCH) * POINTS_PER_INCH;
const A4_HEIGHT_PT = (A4_HEIGHT_MM / MM_PER_INCH) * POINTS_PER_INCH;

const DEFAULT_MARGIN = Math.round(PRINT_DPI * 0.35); // ~9 mm
const DEFAULT_GAP = 1;
const EXTRA_EMPTY_SHEETS = 1;
const MISC_OUTPUT_DIR = resolveOutputPath('misc');

const PLAYER_CARD_SIZE_MM = 85;
const WORK_CARD_SIZE_MM = 78;
const ROLE_CARD_HEIGHT_MM = 100;
const ROLE_CARD_WIDTH_MM = Math.round(ROLE_CARD_HEIGHT_MM * (ROLE_CARD_WIDTH / ROLE_CARD_HEIGHT));

const PRINT_SETS = [
	{
		key: 'milestones',
		label: 'Milestones',
		frontDir: resolveOutputPath('milestones'),
		filter: (name) => name.endsWith('.png') && !name.startsWith('back-'),
		cardWidth: CARD_SIZE,
		cardHeight: CARD_SIZE,
		printWidthMM: PLAYER_CARD_SIZE_MM,
		printHeightMM: PLAYER_CARD_SIZE_MM,
		backStrategy: { type: 'pairedPrefix', prefix: 'back-' },
		emptyCardPath: path.join(MISC_OUTPUT_DIR, 'milestone-empty-front.png'),
		emptyCardBackPath: path.join(MISC_OUTPUT_DIR, 'milestone-empty-back.png')
	},
	{
		key: 'features',
		label: 'Features',
		frontDir: resolveOutputPath('features'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: CARD_SIZE,
		cardHeight: CARD_SIZE,
		printWidthMM: PLAYER_CARD_SIZE_MM,
		printHeightMM: PLAYER_CARD_SIZE_MM,
		backStrategy: { type: 'staticImage', path: path.join(MISC_OUTPUT_DIR, 'player-deck.png') },
		emptyCardPath: path.join(MISC_OUTPUT_DIR, 'feature-empty.png')
	},
	{
		key: 'abilities',
		label: 'Abilities',
		frontDir: resolveOutputPath('abilities'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: CARD_SIZE,
		cardHeight: CARD_SIZE,
		printWidthMM: PLAYER_CARD_SIZE_MM,
		printHeightMM: PLAYER_CARD_SIZE_MM,
		backStrategy: { type: 'staticImage', path: path.join(MISC_OUTPUT_DIR, 'player-deck.png') },
		emptyCardPath: path.join(MISC_OUTPUT_DIR, 'ability-empty.png')
	},
	{
		key: 'roles',
		label: 'Roles',
		frontDir: resolveOutputPath('roles'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: ROLE_CARD_WIDTH,
		cardHeight: ROLE_CARD_HEIGHT,
		printWidthMM: ROLE_CARD_WIDTH_MM,
		printHeightMM: ROLE_CARD_HEIGHT_MM,
		backStrategy: { type: 'staticImage', path: path.join(MISC_OUTPUT_DIR, 'role.png') },
		emptyCardPath: path.join(MISC_OUTPUT_DIR, 'role-empty.png')
	},
	{
		key: 'tickets',
		label: 'Tickets',
		frontDir: resolveOutputPath('tickets'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: TICKET_CARD_SIZE,
		cardHeight: TICKET_CARD_SIZE,
		printWidthMM: WORK_CARD_SIZE_MM,
		printHeightMM: WORK_CARD_SIZE_MM,
		backStrategy: { type: 'staticImage', path: path.join(MISC_OUTPUT_DIR, 'work-deck.png') },
		emptyCardPath: path.join(MISC_OUTPUT_DIR, 'ticket-empty.png')
	},
	{
		key: 'problems',
		label: 'Problems',
		frontDir: resolveOutputPath('problems'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: TICKET_CARD_SIZE,
		cardHeight: TICKET_CARD_SIZE,
		printWidthMM: WORK_CARD_SIZE_MM,
		printHeightMM: WORK_CARD_SIZE_MM,
		backStrategy: { type: 'staticImage', path: path.join(MISC_OUTPUT_DIR, 'work-deck.png') },
		emptyCardPath: path.join(MISC_OUTPUT_DIR, 'problem-empty.png')
	}
];

const imageCache = new Map();

async function main() {
	const printDir = resolveOutputPath('print');
	await fs.rm(printDir, { recursive: true, force: true });
	await fs.mkdir(printDir, { recursive: true });

	const pdfPages = [];
	const sheetSummaries = [];
	let sheetIndex = 1;

	for (const group of PRINT_SETS) {
		const cards = await loadCardPairs(group);
		if (!cards.length) {
			console.warn(`No cards found for ${group.label}, skipping.`);
			continue;
		}

		const layout = buildLayout(group);
		const fillerFactory = createEmptyCardFactory(group);
		const batches = chunk(cards, layout.cardsPerSheet).map((batch) => padBatch(batch, layout.cardsPerSheet, fillerFactory));
		if (fillerFactory) {
			for (let extra = 0; extra < EXTRA_EMPTY_SHEETS; extra++) {
				batches.push(createFullFillerBatch(layout.cardsPerSheet, fillerFactory));
			}
		}
		console.log(`Preparing ${batches.length} sheet(s) for ${group.label} (${cards.length} cards + fillers).`);

		for (const batch of batches) {
			const sheetId = `${String(sheetIndex).padStart(3, '0')}-${group.key}`;
			const { frontBuffer, backBuffer } = await renderSheetPair(batch, layout);
			const frontPath = path.join(printDir, `${sheetId}-front.png`);
			const backPath = path.join(printDir, `${sheetId}-back.png`);
			await fs.writeFile(frontPath, frontBuffer);
			await fs.writeFile(backPath, backBuffer);
			pdfPages.push({ buffer: frontBuffer, label: `${sheetId}-front` });
			pdfPages.push({ buffer: backBuffer, label: `${sheetId}-back` });
			sheetSummaries.push({
				id: sheetId,
				group: group.label,
				totalCards: batch.length,
				frontPath,
				backPath
			});
			sheetIndex++;
		}
	}

	if (!pdfPages.length) {
		console.warn('No sheets were generated. Make sure the card generators ran first.');
		return;
	}

	const localeTag = (LOCALE || 'default').toLowerCase();
	const pdfFileName = `bas-double-sided-cards-${localeTag}.pdf`;
	const pdfPath = path.join(printDir, pdfFileName);
	await writePdf(pdfPath, pdfPages);
	printSummary(sheetSummaries, pdfPath);
}

async function loadCardPairs(group) {
	let entries;
	try {
		entries = await fs.readdir(group.frontDir);
	} catch (error) {
		if (error.code === 'ENOENT') {
			return [];
		}
		throw error;
	}

	const fronts = entries.filter(group.filter).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
	const cards = [];
	for (const frontName of fronts) {
		const frontPath = path.join(group.frontDir, frontName);
		const backPath = await resolveBackPath(group, frontName);
		cards.push({ frontPath, backPath });
	}
	return cards;
}

async function resolveBackPath(group, frontName) {
	const strategy = group.backStrategy || { type: 'staticImage', path: path.join(group.frontDir, frontName) };
	switch (strategy.type) {
		case 'pairedPrefix': {
			const normalizedFront = frontName.replace(new RegExp(`^${strategy.prefix}`), '');
			const backName = `${strategy.prefix}${normalizedFront}`;
			const backDir = strategy.dir ? strategy.dir : group.frontDir;
			const backPath = path.join(backDir, backName);
			await assertFile(backPath, `Missing back image ${backName} for ${frontName}`);
			return backPath;
		}
		case 'staticImage': {
			await assertFile(strategy.path, `Missing static back image at ${strategy.path}`);
			return strategy.path;
		}
		default:
			throw new Error(`Unsupported back strategy: ${strategy.type}`);
	}
}

async function assertFile(targetPath, message) {
	try {
		await fs.access(targetPath);
	} catch (error) {
		if (error.code === 'ENOENT') {
			throw new Error(message);
		}
		throw error;
	}
}

function buildLayout(group) {
	const cardWidth = resolvePrintDimension(group, 'width');
	const cardHeight = resolvePrintDimension(group, 'height');
	const gap = group.gap ?? DEFAULT_GAP;
	let columns = group.columns ?? Math.floor((A4_WIDTH_PX + gap) / (cardWidth + gap));
	let rows = group.rows ?? Math.floor((A4_HEIGHT_PX + gap) / (cardHeight + gap));
	columns = Math.max(columns, 1);
	rows = Math.max(rows, 1);

	return {
		cardWidth,
		cardHeight,
		gap,
		columns,
		rows,
		cardsPerSheet: Math.max(columns * rows, 1)
	};
}

function resolvePrintDimension(group, axis) {
	const mmKey = axis === 'width' ? 'printWidthMM' : 'printHeightMM';
	const pxKey = axis === 'width' ? 'printWidthPx' : 'printHeightPx';
	if (group[mmKey]) {
		return mmToPixels(group[mmKey]);
	}
	if (group[pxKey]) {
		return group[pxKey];
	}
	return axis === 'width' ? group.cardWidth : group.cardHeight;
}

function mmToPixels(mm) {
	if (!mm) {
		return null;
	}
	return Math.round((mm / MM_PER_INCH) * PRINT_DPI);
}

function computePositionsForBatch(count, layout) {
	const positions = new Array(count);
	const rowsNeeded = Math.min(Math.ceil(count / layout.columns), layout.rows);
	const blockHeight = rowsNeeded * layout.cardHeight + Math.max(rowsNeeded - 1, 0) * layout.gap;
	const startY = Math.max(Math.round((A4_HEIGHT_PX - blockHeight) / 2), 0);

	for (let row = 0; row < rowsNeeded; row++) {
		const remaining = count - row * layout.columns;
		if (remaining <= 0) {
			break;
		}
		const cardsInRow = Math.min(layout.columns, remaining);
		const rowWidth = cardsInRow * layout.cardWidth + Math.max(cardsInRow - 1, 0) * layout.gap;
		const rowStartX = Math.max(Math.round((A4_WIDTH_PX - rowWidth) / 2), 0);
		const y = startY + row * (layout.cardHeight + layout.gap);
		for (let col = 0; col < cardsInRow; col++) {
			const index = row * layout.columns + col;
			if (index >= count) {
				break;
			}
			const frontX = rowStartX + col * (layout.cardWidth + layout.gap);
			const frontY = y;
			const backX = A4_WIDTH_PX - frontX - layout.cardWidth;
			positions[index] = { frontX, frontY, backX, backY: frontY };
		}
	}

	return positions;
}

function padBatch(batch, targetSize, fillerFactory) {
	if (!fillerFactory) {
		return batch;
	}
	const result = [...batch];
	while (result.length < targetSize) {
		result.push(fillerFactory());
	}
	return result;
}

function createFullFillerBatch(count, fillerFactory) {
	const result = [];
	for (let i = 0; i < count; i++) {
		result.push(fillerFactory());
	}
	return result;
}

function createEmptyCardFactory(group) {
	if (!group.emptyCardPath) {
		return null;
	}

	const frontPath = group.emptyCardPath;
	let backPath = group.emptyCardBackPath;

	assertFileSync(frontPath, `Missing empty card template for ${group.label} at ${frontPath}`);
	if (backPath) {
		assertFileSync(backPath, `Missing empty card back template for ${group.label} at ${backPath}`);
	}

	if (!backPath) {
		if (group.backStrategy?.type === 'staticImage') {
			backPath = group.backStrategy.path;
		} else {
			backPath = frontPath;
		}
	}

	return () => ({ frontPath, backPath, isFiller: true });
}

function assertFileSync(targetPath, message) {
	try {
		fsSync.accessSync(targetPath, fsSync.constants.R_OK);
	} catch (error) {
		throw new Error(message);
	}
}

async function renderSheetPair(batch, layout) {
	const positions = computePositionsForBatch(batch.length, layout);

	const front = createSheetCanvas();
	await paintBatch(front.ctx, batch, layout, positions, false);

	const back = createSheetCanvas();
	await paintBatch(back.ctx, batch, layout, positions, true);
	drawBackGuides(back.ctx, layout, positions);

	return {
		frontBuffer: front.canvas.toBuffer('image/png'),
		backBuffer: back.canvas.toBuffer('image/png')
	};
}

function createSheetCanvas() {
	const canvas = createCanvas(A4_WIDTH_PX, A4_HEIGHT_PX);
	const ctx = canvas.getContext('2d');
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	return { canvas, ctx };
}

async function paintBatch(ctx, batch, layout, positions, isBack) {
	await Promise.all(
		batch.map(async (card, index) => {
			const imagePath = isBack ? card.backPath : card.frontPath;
			const image = await loadCachedImage(imagePath);
			const coords = positions[index];
			const x = isBack ? coords.backX : coords.frontX;
			const y = isBack ? coords.backY : coords.frontY;
			ctx.drawImage(image, x, y, layout.cardWidth, layout.cardHeight);
		})
	);
}

function drawBackGuides(ctx, layout, positions) {
	if (!positions.length || layout.gap <= 0) {
		return;
	}

	const { cardWidth, cardHeight, columns, rows, gap } = layout;
	const minX = Math.min(...positions.map((pos) => pos.backX));
	const maxX = Math.max(...positions.map((pos) => pos.backX + cardWidth));
	const minY = Math.min(...positions.map((pos) => pos.backY));
	const maxY = Math.max(...positions.map((pos) => pos.backY + cardHeight));

	ctx.save();
	ctx.strokeStyle = '#111';
	ctx.lineWidth = 1;
	ctx.setLineDash([6, 4]);

	for (let col = 0; col < columns - 1; col++) {
		const sample = positions[col];
		if (!sample) continue;
		const x = sample.backX + cardWidth + gap / 2;
		ctx.beginPath();
		ctx.moveTo(x, minY);
		ctx.lineTo(x, maxY);
		ctx.stroke();
	}

	for (let row = 0; row < rows - 1; row++) {
		const sample = positions[row * columns];
		if (!sample) continue;
		const y = sample.backY + cardHeight + gap / 2;
		ctx.beginPath();
		ctx.moveTo(minX, y);
		ctx.lineTo(maxX, y);
		ctx.stroke();
	}

	// central sheet guide
	const centerX = A4_WIDTH_PX / 2;
	ctx.beginPath();
	ctx.moveTo(centerX, 0);
	ctx.lineTo(centerX, A4_HEIGHT_PX);
	ctx.stroke();

	ctx.restore();
}

async function loadCachedImage(imagePath) {
	if (!imageCache.has(imagePath)) {
		imageCache.set(imagePath, loadImage(imagePath));
	}
	return imageCache.get(imagePath);
}

async function writePdf(targetPath, pages) {
	await new Promise((resolve, reject) => {
		const doc = new PDFDocument({ autoFirstPage: false, size: [A4_WIDTH_PT, A4_HEIGHT_PT], margin: 0 });
		const stream = fsSync.createWriteStream(targetPath);
		doc.pipe(stream);
		pages.forEach((page) => {
			doc.addPage();
			doc.image(page.buffer, 0, 0, { width: A4_WIDTH_PT, height: A4_HEIGHT_PT });
		});
		doc.end();
		stream.on('finish', resolve);
		stream.on('error', reject);
		doc.on('error', reject);
	});
}

function chunk(items, size) {
	if (size <= 0) {
		return [items];
	}
	const result = [];
	for (let i = 0; i < items.length; i += size) {
		result.push(items.slice(i, i + size));
	}
	return result;
}

function printSummary(sheets, pdfPath) {
	console.log('\nPrint sheet overview:');
	sheets.forEach((sheet) => {
		const frontName = path.basename(sheet.frontPath);
		const backName = path.basename(sheet.backPath);
		console.log(`- ${sheet.id} [${sheet.group}] -> ${sheet.totalCards} card(s) (${frontName} / ${backName})`);
	});
	console.log(`\nSaved consolidated PDF with ${sheets.length * 2} pages at ${pdfPath}`);
	console.log('Print double-sided (flip on long edge) to keep backs aligned.');
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to build print sheets:', error);
		process.exitCode = 1;
	});
}
