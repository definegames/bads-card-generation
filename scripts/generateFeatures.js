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
const { paintEdgesAndDividers } = require('./utils/edgePainter');
const { resolveOutputPath } = require('./utils/runtimeConfig');
const { getLocalizedText } = require('./utils/textHelpers');
const BLANK_SCORE_WIDTH_TOKEN = '\u2007\u2007\u2007\u2007\u2007\u2007';

async function main() {
	const csvPath = path.resolve(__dirname, '../data/features.csv');
	const outputDir = resolveOutputPath('features');

	await fs.rm(outputDir, { recursive: true, force: true });
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
	if (!isBlank) {
		const watermarkScore = formatScore(record['Score Points']);
		if (watermarkScore !== '') {
			paintScoreWatermark(ctx, watermarkScore);
		}
	}
	const edgeOptions = isBlank ? { edgeColorOverride: '#ffffff' } : undefined;
	paintEdgesAndDividers(ctx, record, edgeOptions);
	paintFeatureContent(ctx, record, { isBlank });

	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

function paintBackground(ctx) {
	ctx.fillStyle = BACKGROUND_COLOR;
	ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);
}

function paintFeatureContent(ctx, record, { isBlank = false } = {}) {
	const safeZoneLeft = EDGE_THICKNESS + CONTENT_PADDING;
	const safeZoneRight = CARD_SIZE - EDGE_THICKNESS - CONTENT_PADDING;
	const safeZoneBottom = CARD_SIZE - EDGE_THICKNESS - CONTENT_PADDING;
	const contentWidth = safeZoneRight - safeZoneLeft;
	const headerBottom = paintHeaderRow(ctx, record, safeZoneRight, { isBlank });
	if (isBlank) {
		return;
	}

	const title = (record.Title || 'Untitled Feature').trim();
	ctx.fillStyle = BODY_TEXT_COLOR;
	ctx.font = '700 30px "Noto Sans", "Noto Color Emoji", "Montserrat", sans-serif';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.fillText(title, safeZoneLeft, headerBottom + 16);

	let cursorY = headerBottom + 60;
	ctx.fillStyle = BODY_TEXT_COLOR;
	ctx.font = '500 19px "Noto Sans", "Noto Color Emoji", "Montserrat", sans-serif';
	const description = getLocalizedText(record, ['Text']);
	cursorY = drawTextBlock(ctx, description, {
		x: safeZoneLeft,
		y: cursorY,
		maxWidth: contentWidth,
		lineHeight: 26,
		blankLineHeight: 24
	});

	const funny = record['Funny text'];
	if (funny && funny.trim()) {
		const funnyOptions = {
			maxWidth: contentWidth,
			lineHeight: 22,
			blankLineHeight: 20
		};
		ctx.font = 'italic 500 18px "Noto Sans", "Noto Color Emoji", "Montserrat", sans-serif';
		const funnyHeight = measureTextBlockHeight(ctx, funny, funnyOptions);
		const funnyGap = 18;
		const minFunnyY = cursorY + funnyGap;
		const bottomAlignedY = safeZoneBottom - funnyHeight;
		const funnyY = Math.max(minFunnyY, bottomAlignedY);
		ctx.fillStyle = '#5c4d40';
		drawTextBlock(ctx, funny, {
			x: safeZoneLeft,
			y: funnyY,
			...funnyOptions
		});
	}
}

function paintHeaderRow(ctx, record, safeZoneRight, { isBlank = false } = {}) {
	const scoreValue = isBlank ? '' : formatScore(record['Score Points']);
	const pillMeasurementValue = isBlank ? BLANK_SCORE_WIDTH_TOKEN : scoreValue;
	const pillMetrics = measureScorePill(ctx, pillMeasurementValue);
	const scoreBottom = drawScorePill(ctx, scoreValue, safeZoneRight, pillMetrics, { isBlank });
	return scoreBottom;
}

function paintScoreWatermark(ctx, scoreValue) {
	if (scoreValue === null || scoreValue === undefined) {
		return;
	}
	const text = String(scoreValue).trim();
	if (!text) {
		return;
	}
	ctx.save();
	ctx.globalAlpha = 0.1;
	ctx.fillStyle = '#1c140d';
	ctx.font = '900 320px "Montserrat", "Noto Sans", "Noto Color Emoji", sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(text, CARD_SIZE / 2, CARD_SIZE / 2);
	ctx.restore();
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
	const { x, y, maxWidth, lineHeight, blankLineHeight = lineHeight } = options;
	const normalized = String(raw ?? '')
		.replace(/\r/g, '')
		.replace(/\t/g, '    ');
	if (!normalized.trim()) {
		return y;
	}

	const lines = normalized.split('\n');
	let cursorY = y;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';

	lines.forEach((line) => {
		if (!line.trim()) {
			cursorY += blankLineHeight;
			return;
		}
		cursorY = drawWrappedLine(ctx, line, x, cursorY, maxWidth, lineHeight);
	});
	return cursorY;
}

function measureTextBlockHeight(ctx, raw = '', options) {
	const { maxWidth, lineHeight, blankLineHeight = lineHeight } = options;
	const normalized = String(raw ?? '')
		.replace(/\r/g, '')
		.replace(/\t/g, '    ');
	if (!normalized.trim()) {
		return 0;
	}

	const lines = normalized.split('\n');
	let height = 0;
	lines.forEach((line) => {
		if (!line.trim()) {
			height += blankLineHeight;
			return;
		}
		height += measureWrappedLineHeight(ctx, line, maxWidth, lineHeight);
	});
	return height;
}

function measureWrappedLineHeight(ctx, text, maxWidth, lineHeight) {
	const tokens = text.match(/\S+\s*/g) || [];
	if (!tokens.length) {
		return lineHeight;
	}
	let line = '';
	let height = 0;
	tokens.forEach((token, index) => {
		const testLine = line + token;
		const metrics = ctx.measureText(testLine);
		if (metrics.width > maxWidth && line) {
			height += lineHeight;
			line = token.trimStart();
		} else {
			line = testLine;
		}

		if (index === tokens.length - 1) {
			height += lineHeight;
		}
	});
	return height;
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

function drawScorePill(ctx, scoreValue, safeZoneRight, metrics, { isBlank = false } = {}) {
	const pillX = safeZoneRight - metrics.width;
	const pillY = EDGE_THICKNESS + 6;

	ctx.fillStyle = '#fff';
	ctx.strokeStyle = '#d8cbbb';
	ctx.lineWidth = 2;
	drawRoundedRect(ctx, pillX, pillY, metrics.width, metrics.height, 14, true);

	if (!isBlank && String(scoreValue || '').trim()) {
		ctx.fillStyle = '#a0692b';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = '700 24px "Montserrat", "Noto Color Emoji", sans-serif';
		ctx.fillText(scoreValue, pillX + metrics.width / 2, pillY + metrics.height / 2);
	}

	return pillY + metrics.height;
}

function measureScorePill(ctx, scoreValue) {
	ctx.save();
	ctx.font = '700 24px "Montserrat", sans-serif';
	const scoreWidth = ctx.measureText(scoreValue).width;
	ctx.restore();
	const pillPaddingX = 18;
	const pillHeight = 44;
	return {
		width: scoreWidth + pillPaddingX * 2,
		height: pillHeight
	};
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
