#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');
require('./utils/fontRegistry'); // Register fonts
const {
	ROLE_CARD_HEIGHT,
	ROLE_CARD_WIDTH,
	RECT_CARD_SCALE
} = require('./utils/constants');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { resolveOutputPath } = require('./utils/runtimeConfig');
const { getLocalizedText } = require('./utils/textHelpers');

const GOAL_CARD_BACKGROUND = '#efebff';
const GOAL_TEXT_COLOR = '#000000';
const GOAL_TITLE_X = 70;
const GOAL_TITLE_Y = 127;
const GOAL_TITLE_FONT = '500 48px "Inter", sans-serif';
const GOAL_DIVIDER_X = 227;
const GOAL_DIVIDER_Y = 247;
const GOAL_DIVIDER_WIDTH = 313;
const GOAL_DIVIDER_COLOR = '#a3a3a3';
const GOAL_DIVIDER_LINE_WIDTH = 1;
const GOAL_TEXT_X = 128;
const GOAL_TEXT_Y = 309;
const GOAL_TEXT_FONT = '400 40px "Inter", sans-serif';
const GOAL_TEXT_LINE_HEIGHT = Math.round(40 * 1.2);
const s = (value) => Math.round(value * RECT_CARD_SCALE);

async function main() {
	const csvPath = path.resolve(__dirname, '../data/goals.csv');
	const outputDir = resolveOutputPath('goals');

	await fs.mkdir(outputDir, { recursive: true });

	const csvRaw = await fs.readFile(csvPath, 'utf8');
	const goals = parse(csvRaw, {
		columns: true,
		skip_empty_lines: true,
		relax_quotes: true
	}).filter((record) => !shouldIgnoreRecord(record));

	const jobs = [];
	for (const record of goals) {
		const title = String(record.Title || '').trim();
		if (!title) {
			continue;
		}
		const copies = normalizeCopies(record.Copies);
		const slug = sanitizeFileName(record.ID || title || 'goal');
		for (let index = 0; index < copies; index += 1) {
			const suffix = copies > 1 ? `-copy${index + 1}` : '';
			const targetPath = path.join(outputDir, `${slug}${suffix}.png`);
			jobs.push(drawGoalCard(targetPath, record));
		}
	}

	await Promise.all(jobs);
	console.log(`Generated ${jobs.length} goal cards in ${outputDir}`);
}

async function drawGoalCard(filePath, record, options = {}) {
	const isBlank = options.blank === true || record.__blank === true;
	const canvas = createCanvas(ROLE_CARD_WIDTH, ROLE_CARD_HEIGHT);
	const ctx = canvas.getContext('2d');

	paintBackground(ctx);
	paintGoalContent(ctx, record, { isBlank });

	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

function paintBackground(ctx) {
	ctx.fillStyle = GOAL_CARD_BACKGROUND;
	ctx.fillRect(0, 0, ROLE_CARD_WIDTH, ROLE_CARD_HEIGHT);
}

function paintGoalContent(ctx, record, { isBlank = false } = {}) {
	const contentWidth = ROLE_CARD_WIDTH - GOAL_TEXT_X * 2;

	const title = String(record.Title || 'Goal').trim();
	if (!isBlank) {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillStyle = GOAL_TEXT_COLOR;
		ctx.font = GOAL_TITLE_FONT;
		ctx.fillText(title, ROLE_CARD_WIDTH / 2, GOAL_TITLE_Y);
	}

	ctx.strokeStyle = GOAL_DIVIDER_COLOR;
	ctx.lineWidth = GOAL_DIVIDER_LINE_WIDTH;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(GOAL_DIVIDER_X, GOAL_DIVIDER_Y);
	ctx.lineTo(GOAL_DIVIDER_X + GOAL_DIVIDER_WIDTH, GOAL_DIVIDER_Y);
	ctx.stroke();

	if (isBlank) {
		return;
	}

	const text = getLocalizedText(record, ['Text']);
	if (!text) {
		return;
	}

	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.fillStyle = GOAL_TEXT_COLOR;
	ctx.font = GOAL_TEXT_FONT;
	drawTextBlock(ctx, text, {
		x: GOAL_TEXT_X,
		y: GOAL_TEXT_Y,
		maxWidth: contentWidth,
		lineHeight: GOAL_TEXT_LINE_HEIGHT,
		blankLineHeight: GOAL_TEXT_LINE_HEIGHT
	});
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
	return String(value ?? '').replace(/[^a-z0-9._-]+/gi, '_');
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to generate goal cards:', error);
		process.exitCode = 1;
	});
}

module.exports = {
	drawGoalCard
};
