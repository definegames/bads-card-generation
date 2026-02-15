#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');
require('./utils/fontRegistry'); // Register fonts
const { TICKET_CARD_SIZE, SMALL_CARD_SCALE, BODY_TEXT_COLOR } = require('./utils/constants');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { resolveOutputPath } = require('./utils/runtimeConfig');
const { getLocalizedText } = require('./utils/textHelpers');

const BACKGROUND_COLOR = '#fffdf8';
const BORDER_COLOR = '#d9cbbd';
const TITLE_COLOR = '#c52233';
const FUNNY_TEXT_COLOR = '#7a4a38';
const s = (value) => Math.round(value * SMALL_CARD_SCALE);

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

	ctx.strokeStyle = BORDER_COLOR;
	ctx.lineWidth = s(4);
	ctx.strokeRect(s(2), s(2), TICKET_CARD_SIZE - s(4), TICKET_CARD_SIZE - s(4));
}

function paintProblem(ctx, record, { isBlank = false } = {}) {
	const padding = s(28);
	const safeLeft = padding;
	const safeRight = TICKET_CARD_SIZE - padding;
	const contentWidth = safeRight - safeLeft;

	const title = (record.Title || 'Problem').trim().toUpperCase();
	if (!isBlank) {
		ctx.fillStyle = TITLE_COLOR;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.font = `700 ${s(30)}px "Inter", sans-serif`;
		ctx.fillText(title, safeLeft, padding);
	}

	const delimiterY = padding + s(48);
	ctx.strokeStyle = '#edd9cf';
	ctx.lineWidth = s(2);
	ctx.beginPath();
	ctx.moveTo(safeLeft, delimiterY);
	ctx.lineTo(safeRight, delimiterY);
	ctx.stroke();

	if (isBlank) {
		return;
	}

	let cursorY = delimiterY + s(18);
	const mainText = getLocalizedText(record, ['Text']);
	if (mainText) {
		ctx.fillStyle = BODY_TEXT_COLOR;
		ctx.font = `500 ${s(20)}px "Inter", sans-serif`;
		cursorY = drawTextBlock(ctx, mainText, {
			x: safeLeft,
			y: cursorY,
			maxWidth: contentWidth,
			lineHeight: s(26)
		});
	}

	const funny = (record['Funny text'] || '').trim();
	if (funny) {
		cursorY += s(16);
		ctx.fillStyle = FUNNY_TEXT_COLOR;
		ctx.font = `italic 500 ${s(20)}px "Inter", sans-serif`;
		drawTextBlock(ctx, funny, {
			x: safeLeft,
			y: cursorY,
			maxWidth: contentWidth,
			lineHeight: s(26)
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
