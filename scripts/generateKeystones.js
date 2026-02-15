#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');
require('./utils/fontRegistry'); // Register fonts
const {
	CARD_SIZE,
	EDGE_THICKNESS,
	CONTENT_PADDING,
	LARGE_CARD_TITLE_LEFT,
	LARGE_CARD_TITLE_TOP,
	LARGE_CARD_TITLE_FONT_SIZE,
	LARGE_CARD_TITLE_FONT_WEIGHT,
	LARGE_CARD_SCALE,
	BODY_TEXT_COLOR,
	KEYSTONE_BACK_FILE_NAME
} = require('./utils/constants');
const { paintEdgesAndDividers } = require('./utils/edgePainter');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { resolveOutputPath } = require('./utils/runtimeConfig');
const { getLocalizedText } = require('./utils/textHelpers');

const KEYSTONE_FACE_BACKGROUND = '#e3f2ff';
const KEYSTONE_DIVIDER_COLOR = '#c5d7f2';
const KEYSTONE_BACK_BORDER = '#b3caf6';
const KEYSTONE_BACK_GRADIENT_START = '#f8fbff';
const KEYSTONE_BACK_GRADIENT_END = '#bed5ff';
const KEYSTONE_BACK_TEXT = '#1f2d46';
const s = (value) => Math.round(value * LARGE_CARD_SCALE);

async function main() {
	const csvPath = path.resolve(__dirname, '../data/keystones.csv');
	const outputDir = resolveOutputPath('keystones');
	const miscDir = resolveOutputPath('misc');
	await Promise.all([
		fs.mkdir(outputDir, { recursive: true }),
		fs.mkdir(miscDir, { recursive: true })
	]);

	const csvRaw = await fs.readFile(csvPath, 'utf8');
	const keystones = parse(csvRaw, {
		columns: true,
		skip_empty_lines: true,
		relax_quotes: true
	});

	const filteredKeystones = keystones.filter((record) => !shouldIgnoreRecord(record));

	await Promise.all(
		filteredKeystones.map(async (record) => {
			const baseName = sanitizeFileName(record.ID || record.Title || 'keystone');
			const frontPath = path.join(outputDir, `${baseName}.png`);
			await drawKeystoneFront(frontPath, record);
		})
	);

	const sharedBackPath = path.join(miscDir, KEYSTONE_BACK_FILE_NAME);
	await drawKeystoneBack(sharedBackPath, {});

	console.log(
		`Generated ${filteredKeystones.length} keystone card faces in ${outputDir} and shared back at ${sharedBackPath}`
	);
}

function sanitizeFileName(value) {
	return value.replace(/[^a-z0-9._-]+/gi, '_');
}

function paintFaceBackground(ctx) {
	ctx.fillStyle = KEYSTONE_FACE_BACKGROUND;
	ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);
}

async function drawKeystoneFront(filePath, record, options = {}) {
	const canvas = createCanvas(CARD_SIZE, CARD_SIZE);
	const ctx = canvas.getContext('2d');
	const isBlank = options.blank === true || record.__blank === true;

	paintFaceBackground(ctx);
	paintEdgesAndDividers(ctx, record);
	paintKeystoneCopy(ctx, record, { isBlank });

	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

async function drawKeystoneBack(filePath, record, options = {}) {
	const canvas = createCanvas(CARD_SIZE, CARD_SIZE);
	const ctx = canvas.getContext('2d');
	const isBlank = options.blank === true || record.__blank === true;

	paintKeystoneBack(ctx, { isBlank });

	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

function paintKeystoneCopy(ctx, record, { isBlank = false } = {}) {
	if (isBlank) {
		return;
	}

	const safeZoneLeft = EDGE_THICKNESS + CONTENT_PADDING;
	const safeZoneRight = CARD_SIZE - EDGE_THICKNESS - CONTENT_PADDING;
	const contentWidth = safeZoneRight - safeZoneLeft;

	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.fillStyle = BODY_TEXT_COLOR;
	ctx.font = `${LARGE_CARD_TITLE_FONT_WEIGHT} ${LARGE_CARD_TITLE_FONT_SIZE}px "Inter", sans-serif`;
	ctx.fillText((record.Title || '').trim(), LARGE_CARD_TITLE_LEFT, LARGE_CARD_TITLE_TOP);

	ctx.strokeStyle = KEYSTONE_DIVIDER_COLOR;
	ctx.lineWidth = s(2);
	ctx.beginPath();
	ctx.moveTo(safeZoneLeft, EDGE_THICKNESS + s(70));
	ctx.lineTo(safeZoneRight, EDGE_THICKNESS + s(70));
	ctx.stroke();

	ctx.textAlign = 'left';
	ctx.font = `500 ${s(20)}px "Inter", sans-serif`;
	ctx.fillStyle = BODY_TEXT_COLOR;

	let cursorY = EDGE_THICKNESS + s(86);
	const bodyCopy = getLocalizedText(record, ['Text']);
	cursorY = drawTextBlock(ctx, bodyCopy, {
		x: safeZoneLeft,
		y: cursorY,
		maxWidth: contentWidth,
		lineHeight: s(26),
		blankLineHeight: s(24)
	});

	const funny = (record['Funny text'] || '').trim();
	if (funny) {
		cursorY += s(16);
		ctx.font = `italic 500 ${s(18)}px "Inter", sans-serif`;
		cursorY = drawTextBlock(ctx, funny, {
			x: safeZoneLeft,
			y: cursorY,
			maxWidth: contentWidth,
			lineHeight: s(22),
			blankLineHeight: s(20)
		});
	}
}

function paintKeystoneBack(ctx, { isBlank = false } = {}) {
	ctx.fillStyle = KEYSTONE_BACK_BORDER;
	ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

	const gradient = ctx.createLinearGradient(EDGE_THICKNESS, EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
	gradient.addColorStop(0, KEYSTONE_BACK_GRADIENT_START);
	gradient.addColorStop(1, KEYSTONE_BACK_GRADIENT_END);
	ctx.fillStyle = gradient;
	ctx.fillRect(EDGE_THICKNESS, EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS * 2, CARD_SIZE - EDGE_THICKNESS * 2);

	if (isBlank) {
		return;
	}

	ctx.fillStyle = KEYSTONE_BACK_TEXT;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = `700 ${s(58)}px "Inter", sans-serif`;
	ctx.fillText('Keystone', CARD_SIZE / 2, CARD_SIZE / 2);
}

function drawTextBlock(ctx, raw = '', options) {
	const { x, y, maxWidth, lineHeight, blankLineHeight = lineHeight } = options;
	const normalized = String(raw ?? '')
		.replace(/\r/g, '')
		.replace(/\t/g, '    ');
	if (!normalized.trim()) {
		return y;
	}

	const lines = normalized.split('\n');
	let cursorY = y;
	lines.forEach((line) => {
		if (!line.trim()) {
			cursorY += blankLineHeight;
			return;
		}
		cursorY = drawWrappedLine(ctx, line, x, cursorY, maxWidth, lineHeight);
	});
	return cursorY;
}

function drawWrappedLine(ctx, text, x, startY, maxWidth, lineHeight) {
	const tokens = text.match(/\S+\s*/g) || [];
	let line = '';
	let cursorY = startY;

	tokens.forEach((token, index) => {
		const testLine = line + token;
		const metrics = ctx.measureText(testLine);
		if (metrics.width > maxWidth && line) {
			ctx.fillText(line.trimEnd(), x, cursorY);
			line = token.trimStart();
			cursorY += lineHeight;
		} else {
			line = testLine;
		}

		if (index === tokens.length - 1) {
			ctx.fillText(line.trimEnd(), x, cursorY);
			cursorY += lineHeight;
		}
	});

	if (!tokens.length) {
		ctx.fillText('', x, cursorY);
		cursorY += lineHeight;
	}

	return cursorY;
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to generate keystone cards:', error);
		process.exitCode = 1;
	});
}

module.exports = {
	drawKeystoneFront,
	drawKeystoneBack
};
