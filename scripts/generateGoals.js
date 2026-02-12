#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');
require('./utils/fontRegistry'); // Register fonts
const {
	EDGE_THICKNESS,
	CONTENT_PADDING,
	BODY_TEXT_COLOR,
	ROLE_CARD_HEIGHT,
	ROLE_CARD_WIDTH,
	RECT_CARD_SCALE
} = require('./utils/constants');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { resolveOutputPath } = require('./utils/runtimeConfig');
const { getLocalizedText } = require('./utils/textHelpers');

const GOAL_CARD_BACKGROUND = '#cbd6e6';
const GOAL_ACCENT_COLOR = '#1f3b68';
const GOAL_OUTLINE_COLOR = '#0e1083';
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

	ctx.strokeStyle = GOAL_OUTLINE_COLOR;
	ctx.lineWidth = s(4);
	ctx.strokeRect(
		EDGE_THICKNESS / 2,
		EDGE_THICKNESS / 2,
		ROLE_CARD_WIDTH - EDGE_THICKNESS,
		ROLE_CARD_HEIGHT - EDGE_THICKNESS
	);

	const gradient = ctx.createLinearGradient(0, 0, ROLE_CARD_WIDTH, ROLE_CARD_HEIGHT);
	gradient.addColorStop(0, `${GOAL_ACCENT_COLOR}22`);
	gradient.addColorStop(0.5, `${GOAL_ACCENT_COLOR}00`);
	gradient.addColorStop(1, `${GOAL_ACCENT_COLOR}18`);
	ctx.fillStyle = gradient;
	ctx.fillRect(
		EDGE_THICKNESS,
		EDGE_THICKNESS,
		ROLE_CARD_WIDTH - EDGE_THICKNESS * 2,
		ROLE_CARD_HEIGHT - EDGE_THICKNESS * 2
	);
}

function paintGoalContent(ctx, record, { isBlank = false } = {}) {
	const safeLeft = EDGE_THICKNESS + CONTENT_PADDING;
	const safeRight = ROLE_CARD_WIDTH - EDGE_THICKNESS - CONTENT_PADDING;
	const safeTop = EDGE_THICKNESS + CONTENT_PADDING;
	const contentWidth = safeRight - safeLeft;

	const title = String(record.Title || 'Goal').trim();
	let titleFontSize = 0;
	if (!isBlank) {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillStyle = BODY_TEXT_COLOR;
		const fitted = fitTitleFont(ctx, title, contentWidth);
		titleFontSize = fitted.size;
		ctx.font = fitted.font;
		ctx.fillText(title, ROLE_CARD_WIDTH / 2, safeTop);
	}

	const dividerY = safeTop + (titleFontSize || s(44)) + s(18);
	ctx.strokeStyle = GOAL_OUTLINE_COLOR;
	ctx.lineWidth = s(2);
	ctx.beginPath();
	ctx.moveTo(safeLeft, dividerY);
	ctx.lineTo(safeRight, dividerY);
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
	ctx.fillStyle = BODY_TEXT_COLOR;
	ctx.font = `500 ${s(20)}px "Noto Sans", "Noto Color Emoji", "Montserrat", sans-serif`;
	drawTextBlock(ctx, text, {
		x: safeLeft,
		y: dividerY + s(24),
		maxWidth: contentWidth,
		lineHeight: s(28),
		blankLineHeight: s(24)
	});
}

function fitTitleFont(ctx, title, maxWidth) {
	let size = s(30);
	const minSize = s(20);
	while (size >= minSize) {
		ctx.font = `700 ${size}px "Noto Sans", "Noto Color Emoji", "Montserrat", sans-serif`;
		if (ctx.measureText(title).width <= maxWidth) {
			return {
				size,
				font: ctx.font
			};
		}
		size -= s(2);
	}
	ctx.font = `700 ${minSize}px "Noto Sans", "Noto Color Emoji", "Montserrat", sans-serif`;
	return { size: minSize, font: ctx.font };
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
