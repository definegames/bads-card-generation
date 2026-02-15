#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');
require('./utils/fontRegistry'); // Register fonts
const {
	CARD_SIZE,
	LARGE_CARD_SCALE,
	BODY_TEXT_COLOR
} = require('./utils/constants');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { paintEdgesAndDividers } = require('./utils/edgePainter');
const { resolveOutputPath } = require('./utils/runtimeConfig');
const { getLocalizedText } = require('./utils/textHelpers');

const s = (value) => Math.round(value * LARGE_CARD_SCALE);
const TITLE_X = 119;
const TITLE_Y = 159;
const TITLE_MAX_WIDTH = CARD_SIZE - TITLE_X * 2;
const FUNNY_TEXT_Y = 777;
const FUNNY_TEXT_MAX_WIDTH = CARD_SIZE - 119 * 2;
const FEATURE_PILL_X = 853;
const FEATURE_PILL_Y = 32;
const FEATURE_PILL_WIDTH = 120;
const FEATURE_PILL_HEIGHT = 100;
const FEATURE_PILL_RADIUS = 25;

const SCORE_STYLES = {
	1: {
		watermark: '#f0f0f0',
		pillBackground: '#efefef',
		pillBorder: '#c5c5c5',
		pillText: '#7b7d7b'
	},
	2: {
		watermark: '#eaffeb',
		pillBackground: '#efefef',
		pillBorder: '#aed9b0',
		pillText: '#72a774'
	},
	4: {
		watermark: '#ebf4ff',
		pillBackground: '#efefef',
		pillBorder: '#bcdafe',
		pillText: '#5c82b1'
	},
	8: {
		watermark: '#faedff',
		pillBackground: '#efefef',
		pillBorder: '#d3b7de',
		pillText: '#a265b9'
	}
};

async function main() {
	const csvPath = path.resolve(__dirname, '../data/features.csv');
	const outputDir = resolveOutputPath('features');

	await fs.mkdir(outputDir, { recursive: true });

	const csvRaw = await fs.readFile(csvPath, 'utf8');
	const features = parse(csvRaw, {
		columns: true,
		skip_empty_lines: true,
		relax_quotes: true
	}).filter((record) => !shouldIgnoreRecord(record));

	const tasks = [];
	for (const record of features) {
		const copies = normalizeCopies(record.Copies);
		const slug = sanitizeFileName(record.ID || record.Title || 'feature');
		for (let i = 0; i < copies; i++) {
			const suffix = copies > 1 ? `-copy${i + 1}` : '';
			const filePath = path.join(outputDir, `${slug}${suffix}.png`);
			tasks.push(drawFeatureCard(filePath, record));
		}
	}

	await Promise.all(tasks);

	console.log(`Generated ${tasks.length} feature cards in ${outputDir}`);
}

async function drawFeatureCard(filePath, record, options = {}) {
	const isBlank = options.blank === true || record.__blank === true;
	const canvas = createCanvas(CARD_SIZE, CARD_SIZE);
	const ctx = canvas.getContext('2d');

	paintBackground(ctx);
	paintEdgesAndDividers(ctx, record);
	paintFeatureContent(ctx, record, { isBlank });

	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

function paintBackground(ctx) {
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);
}

function paintFeatureContent(ctx, record, { isBlank = false } = {}) {
	const scoreValue = isBlank ? '' : formatScore(record['Score Points']);
	const scoreStyle = resolveScoreStyle(scoreValue);
	const headerBottom = paintHeaderRow(ctx, scoreValue, scoreStyle, { isBlank });

	if (isBlank) {
		return;
	}

	if (scoreValue !== '') {
		paintScoreWatermark(ctx, scoreValue, scoreStyle);
	}

	const title = (record.Title || 'Untitled Feature').trim();
	ctx.fillStyle = BODY_TEXT_COLOR;
	ctx.font = '500 64px "Inter", sans-serif';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.fillText(title, TITLE_X, TITLE_Y, TITLE_MAX_WIDTH);

	let cursorY = headerBottom + s(60);
	ctx.fillStyle = BODY_TEXT_COLOR;
	ctx.font = `500 ${s(19)}px "Inter", sans-serif`;
	const description = getLocalizedText(record, ['Text']);
	cursorY = drawTextBlock(ctx, description, {
		x: TITLE_X,
		y: cursorY,
		maxWidth: TITLE_MAX_WIDTH,
		lineHeight: s(26),
		blankLineHeight: s(24),
		align: 'left'
	});

	const funny = record['Funny text'];
	if (funny && funny.trim()) {
		ctx.font = 'italic 400 36px "Inter", sans-serif';
		ctx.fillStyle = '#949494';
		drawTextBlock(ctx, funny, {
			x: CARD_SIZE / 2,
			y: FUNNY_TEXT_Y,
			maxWidth: FUNNY_TEXT_MAX_WIDTH,
			lineHeight: s(32),
			blankLineHeight: s(32),
			align: 'center'
		});
	}
}

function resolveScoreStyle(scoreValue) {
	const normalized = Number(scoreValue);
	if (Number.isFinite(normalized) && SCORE_STYLES[normalized]) {
		return SCORE_STYLES[normalized];
	}
	return SCORE_STYLES[1];
}

function paintHeaderRow(ctx, scoreValue, scoreStyle, { isBlank = false } = {}) {
	return drawScorePill(ctx, scoreValue, scoreStyle, { isBlank });
}

function paintScoreWatermark(ctx, scoreValue, scoreStyle) {
	if (scoreValue === null || scoreValue === undefined) {
		return;
	}
	const text = String(scoreValue).trim();
	if (!text) {
		return;
	}
	ctx.fillStyle = scoreStyle.watermark;
	ctx.font = `700 ${s(320)}px "Inter", sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(text, CARD_SIZE / 2, CARD_SIZE / 2);
}

function drawRoundedRect(ctx, x, y, width, height, radius, stroke = false) {
	ctx.save();
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
	ctx.fill();
	if (stroke) {
		ctx.stroke();
	}
	ctx.restore();
}

function drawTextBlock(ctx, raw = '', options) {
	const { x, y, maxWidth, lineHeight, blankLineHeight = lineHeight, align = 'left' } = options;
	const normalized = String(raw ?? '')
		.replace(/\r/g, '')
		.replace(/\t/g, '    ');
	if (!normalized.trim()) {
		return y;
	}

	const lines = normalized.split('\n');
	let cursorY = y;
	ctx.textAlign = align;
	ctx.textBaseline = 'top';

	lines.forEach((line) => {
		if (!line.trim()) {
			cursorY += blankLineHeight;
			return;
		}
		cursorY = drawWrappedLine(ctx, line, x, cursorY, maxWidth, lineHeight, align);
	});
	return cursorY;
}

function drawWrappedLine(ctx, text, x, startY, maxWidth, lineHeight, align = 'left') {
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

function formatScore(value) {
	const numeric = Number(value);
	if (Number.isNaN(numeric)) {
		const fallback = String(value ?? '').trim();
		return fallback;
	}
	return `${numeric}`;
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

function drawScorePill(ctx, scoreValue, scoreStyle, { isBlank = false } = {}) {
	const pillX = FEATURE_PILL_X;
	const pillY = FEATURE_PILL_Y;

	ctx.fillStyle = scoreStyle.pillBackground;
	ctx.strokeStyle = scoreStyle.pillBorder;
	ctx.lineWidth = 2;
	drawRoundedRect(ctx, pillX, pillY, FEATURE_PILL_WIDTH, FEATURE_PILL_HEIGHT, FEATURE_PILL_RADIUS, true);

	if (!isBlank && String(scoreValue || '').trim()) {
		ctx.fillStyle = scoreStyle.pillText;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = '700 72px "Inter", sans-serif';
		ctx.fillText(scoreValue, pillX + FEATURE_PILL_WIDTH / 2, pillY + FEATURE_PILL_HEIGHT / 2);
	}

	return pillY + FEATURE_PILL_HEIGHT;
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to generate feature cards:', error);
		process.exitCode = 1;
	});
}

module.exports = {
	drawFeatureCard
};
