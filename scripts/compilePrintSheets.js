#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const { createCanvas, loadImage } = require('canvas');
const PDFDocument = require('pdfkit');
const { CARD_SIZE, ROLE_CARD_WIDTH, ROLE_CARD_HEIGHT, TICKET_CARD_SIZE } = require('./utils/constants');

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
const DEFAULT_GAP = Math.round(PRINT_DPI * 0.08); // ~2 mm

const PLAYER_CARD_SIZE_MM = 85;
const WORK_CARD_SIZE_MM = 78;
const ROLE_CARD_HEIGHT_MM = 100;
const ROLE_CARD_WIDTH_MM = Math.round(ROLE_CARD_HEIGHT_MM * (ROLE_CARD_WIDTH / ROLE_CARD_HEIGHT));

const PRINT_SETS = [
	{
		key: 'milestones',
		label: 'Milestones',
		frontDir: path.resolve(__dirname, '../outputs/milestones'),
		filter: (name) => name.endsWith('.png') && !name.startsWith('back-'),
		cardWidth: CARD_SIZE,
		cardHeight: CARD_SIZE,
		printWidthMM: PLAYER_CARD_SIZE_MM,
		printHeightMM: PLAYER_CARD_SIZE_MM,
		backStrategy: { type: 'pairedPrefix', prefix: 'back-' }
	},
	{
		key: 'features',
		label: 'Features',
		frontDir: path.resolve(__dirname, '../outputs/features'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: CARD_SIZE,
		cardHeight: CARD_SIZE,
		printWidthMM: PLAYER_CARD_SIZE_MM,
		printHeightMM: PLAYER_CARD_SIZE_MM,
		backStrategy: { type: 'staticImage', path: path.resolve(__dirname, '../outputs/misc/player-deck.png') }
	},
	{
		key: 'abilities',
		label: 'Abilities',
		frontDir: path.resolve(__dirname, '../outputs/abilities'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: CARD_SIZE,
		cardHeight: CARD_SIZE,
		printWidthMM: PLAYER_CARD_SIZE_MM,
		printHeightMM: PLAYER_CARD_SIZE_MM,
		backStrategy: { type: 'staticImage', path: path.resolve(__dirname, '../outputs/misc/player-deck.png') }
	},
	{
		key: 'roles',
		label: 'Roles',
		frontDir: path.resolve(__dirname, '../outputs/roles'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: ROLE_CARD_WIDTH,
		cardHeight: ROLE_CARD_HEIGHT,
		printWidthMM: ROLE_CARD_WIDTH_MM,
		printHeightMM: ROLE_CARD_HEIGHT_MM,
		backStrategy: { type: 'staticImage', path: path.resolve(__dirname, '../outputs/misc/role.png') }
	},
	{
		key: 'tickets',
		label: 'Tickets',
		frontDir: path.resolve(__dirname, '../outputs/tickets'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: TICKET_CARD_SIZE,
		cardHeight: TICKET_CARD_SIZE,
		printWidthMM: WORK_CARD_SIZE_MM,
		printHeightMM: WORK_CARD_SIZE_MM,
		backStrategy: { type: 'staticImage', path: path.resolve(__dirname, '../outputs/misc/work-deck.png') }
	},
	{
		key: 'problems',
		label: 'Problems',
		frontDir: path.resolve(__dirname, '../outputs/problems'),
		filter: (name) => name.endsWith('.png'),
		cardWidth: TICKET_CARD_SIZE,
		cardHeight: TICKET_CARD_SIZE,
		printWidthMM: WORK_CARD_SIZE_MM,
		printHeightMM: WORK_CARD_SIZE_MM,
		backStrategy: { type: 'staticImage', path: path.resolve(__dirname, '../outputs/misc/work-deck.png') }
	}
];

const imageCache = new Map();

async function main() {
	const printDir = path.resolve(__dirname, '../outputs/print');
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
		const batches = chunk(cards, layout.cardsPerSheet);
		console.log(`Preparing ${batches.length} sheet(s) for ${group.label} (${cards.length} cards).`);

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

	const pdfPath = path.join(printDir, 'bads-double-sided-cards.pdf');
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

async function renderSheetPair(batch, layout) {
	const positions = computePositionsForBatch(batch.length, layout);

	const front = createSheetCanvas();
	await paintBatch(front.ctx, batch, layout, positions, false);

	const back = createSheetCanvas();
	await paintBatch(back.ctx, batch, layout, positions, true);

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
