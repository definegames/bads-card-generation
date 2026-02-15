#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');
require('./utils/fontRegistry'); // Register fonts
const { TICKET_CARD_SIZE } = require('./utils/constants');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { resolveOutputPath } = require('./utils/runtimeConfig');
const { getLocalizedText } = require('./utils/textHelpers');

const BACKGROUND_COLOR = '#ffffff';
const TITLE_COLOR = '#d02626';
const TITLE_X = 61;
const TITLE_Y = 66;
const TITLE_FONT = '900 64px "Inter", sans-serif';
const DELIMITER_X = 127;
const DELIMITER_Y = 189;
const DELIMITER_WIDTH = 513;
const DELIMITER_COLOR = '#a3a3a3';
const DELIMITER_LINE_WIDTH = 1;
const TEXT_X = 61;
const TEXT_Y = 226;
const TEXT_FONT = '400 36px "Inter", sans-serif';
const PROBLEM_TEXT_LINE_HEIGHT = 42;

async function main() {
	const csvPath = path.resolve(__dirname, '../data/problems.csv');
	const outputDir = resolveOutputPath('problems');

	await fs.mkdir(outputDir, { recursive: true });

	const csvRaw = await fs.readFile(csvPath, 'utf8');
	const problems = parse(csvRaw, {
		columns: true,
		skip_empty_lines: true,
		trim: true
	}).filter((record) => !shouldIgnoreRecord(record));

	const tasks = [];
	for (const problem of problems) {
		const copies = normalizeCopies(problem.Copies);
		const baseSlug = buildSlug(problem);
		for (let i = 0; i < copies; i++) {
			const suffix = copies > 1 ? `-copy${i + 1}` : '';
			const targetPath = path.join(outputDir, `${baseSlug}${suffix}.png`);
			tasks.push(drawProblemCard(targetPath, problem));
		}
	}

	await Promise.all(tasks);
	console.log(`Generated ${tasks.length} problem cards in ${outputDir}`);
}

async function drawProblemCard(filePath, record, options = {}) {
	const isBlank = options.blank === true || record.__blank === true;
	const canvas = createCanvas(TICKET_CARD_SIZE, TICKET_CARD_SIZE);
	const ctx = canvas.getContext('2d');

	paintBackground(ctx);
	paintProblem(ctx, record, { isBlank });

	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

function paintBackground(ctx) {
	ctx.fillStyle = BACKGROUND_COLOR;
	ctx.fillRect(0, 0, TICKET_CARD_SIZE, TICKET_CARD_SIZE);
}

function paintProblem(ctx, record, { isBlank = false } = {}) {
	const contentWidth = TICKET_CARD_SIZE - TEXT_X * 2;

	const title = (record.Title || 'Problem').trim().toUpperCase();
	if (!isBlank) {
		ctx.fillStyle = TITLE_COLOR;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.font = TITLE_FONT;
		ctx.fillText(title, TITLE_X, TITLE_Y);
	}

	ctx.strokeStyle = DELIMITER_COLOR;
	ctx.lineWidth = DELIMITER_LINE_WIDTH;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(DELIMITER_X, DELIMITER_Y);
	ctx.lineTo(DELIMITER_X + DELIMITER_WIDTH, DELIMITER_Y);
	ctx.stroke();

	if (isBlank) {
		return;
	}

	let cursorY = TEXT_Y;
	const mainText = getLocalizedText(record, ['Text']);
	if (mainText) {
		ctx.fillStyle = '#000000';
		ctx.font = TEXT_FONT;
		cursorY = drawTextBlock(ctx, mainText, {
			x: TEXT_X,
			y: cursorY,
			maxWidth: contentWidth,
			lineHeight: PROBLEM_TEXT_LINE_HEIGHT
		});
	}
}

function drawTextBlock(ctx, text, { x, y, maxWidth, lineHeight }) {
	const lines = (text || '')
		.replace(/\r/g, '')
		.replace(/\t/g, '    ')
		.split('\n');

	let cursorY = y;
	lines.forEach((line) => {
		const trimmed = line.trimEnd();
		if (!trimmed) {
			cursorY += lineHeight;
			return;
		}
		cursorY = drawWrappedLine(ctx, trimmed, x, cursorY, maxWidth, lineHeight);
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

function normalizeCopies(value) {
	const count = Number(value);
	if (!Number.isFinite(count) || count <= 0) {
		return 1;
	}
	return Math.floor(count);
}

function buildSlug(record) {
	const title = (record.Title || 'problem').trim().toLowerCase();
	const addon = (record.Addon || '').trim().toLowerCase();
	const parts = [addon, title].filter(Boolean);
	return parts.join('.').replace(/[^a-z0-9._-]+/gi, '_') || 'problem-card';
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to generate problem cards:', error);
		process.exitCode = 1;
	});
}

module.exports = {
	drawProblemCard
};
