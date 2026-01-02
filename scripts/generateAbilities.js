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
	BACKGROUND_COLOR,
	BODY_TEXT_COLOR
} = require('./utils/constants');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { resolveOutputPath } = require('./utils/runtimeConfig');
const { getLocalizedText } = require('./utils/textHelpers');

async function main() {
	const csvPath = path.resolve(__dirname, '../data/abilities.csv');
	const outputDir = resolveOutputPath('abilities');

	await fs.mkdir(outputDir, { recursive: true });

	const csvRaw = await fs.readFile(csvPath, 'utf8');
	const abilities = parse(csvRaw, {
		columns: true,
		skip_empty_lines: true,
		relax_quotes: true
	}).filter((record) => !shouldIgnoreRecord(record));

	const jobs = [];
	for (const ability of abilities) {
		const copies = normalizeCopies(ability.Copies);
		const slug = sanitizeFileName(ability.ID || ability.Title || 'ability');
		for (let index = 0; index < copies; index++) {
			const suffix = copies > 1 ? `-copy${index + 1}` : '';
			const targetPath = path.join(outputDir, `${slug}${suffix}.png`);
			jobs.push(drawAbilityCard(targetPath, ability));
		}
	}

	await Promise.all(jobs);

	console.log(`Generated ${jobs.length} ability cards in ${outputDir}`);
}

async function drawAbilityCard(filePath, record, options = {}) {
	const isBlank = options.blank === true || record.__blank === true;
	const canvas = createCanvas(CARD_SIZE, CARD_SIZE);
	const ctx = canvas.getContext('2d');

	paintBackground(ctx);
	paintAbilityContent(ctx, record, { isBlank });

	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

function paintBackground(ctx) {
	ctx.fillStyle = BACKGROUND_COLOR;
	ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

	ctx.strokeStyle = '#d4cdc3';
	ctx.lineWidth = 4;
	ctx.strokeRect(EDGE_THICKNESS / 2, EDGE_THICKNESS / 2, CARD_SIZE - EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
}

function paintAbilityContent(ctx, record, { isBlank = false } = {}) {
	const safeLeft = EDGE_THICKNESS + CONTENT_PADDING;
	const safeRight = CARD_SIZE - EDGE_THICKNESS - CONTENT_PADDING;
	const safeWidth = safeRight - safeLeft;
	const top = EDGE_THICKNESS + CONTENT_PADDING;

	if (!isBlank) {
		const title = (record.Title || 'Untitled Ability').trim();
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillStyle = BODY_TEXT_COLOR;
		ctx.font = '700 34px "Noto Sans", "Noto Color Emoji", "Montserrat", sans-serif';
		ctx.fillText(title, CARD_SIZE / 2, top);
	}

	ctx.strokeStyle = '#d9cbbd';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(safeLeft, top + 48);
	ctx.lineTo(safeRight, top + 48);
	ctx.stroke();

	if (isBlank) {
		return;
	}
	let cursorY = top + 60;
	ctx.textAlign = 'left';
	ctx.fillStyle = BODY_TEXT_COLOR;
	ctx.font = '500 20px "Noto Sans", "Noto Color Emoji", "Montserrat", sans-serif';
	const description = getLocalizedText(record, ['Text']);
	cursorY = drawTextBlock(ctx, description, {
		x: safeLeft,
		y: cursorY,
		maxWidth: safeWidth,
		lineHeight: 28,
		blankLineHeight: 24
	});

	const funny = record['Funny text'];
	if (funny && funny.trim()) {
		cursorY += 20;
		ctx.font = 'italic 500 18px "Noto Sans", "Noto Color Emoji", "Montserrat", sans-serif';
		ctx.fillStyle = '#5c4d40';
		drawTextBlock(ctx, funny, {
			x: safeLeft,
			y: cursorY,
			maxWidth: safeWidth,
			lineHeight: 24,
			blankLineHeight: 20
		});
	}
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
	ctx.textBaseline = 'top';
	ctx.textAlign = 'left';

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
		const width = ctx.measureText(testLine).width;
		if (width > maxWidth && line) {
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

function normalizeCopies(value) {
	const numeric = Number(value);
	if (!Number.isFinite(numeric) || numeric < 1) {
		return 1;
	}
	return Math.floor(numeric);
}

function sanitizeFileName(value) {
	return value.replace(/[^a-z0-9._-]+/gi, '_');
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to generate ability cards:', error);
		process.exitCode = 1;
	});
}

module.exports = {
	drawAbilityCard
};
