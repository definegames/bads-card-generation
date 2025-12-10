#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');
const {
	CARD_SIZE,
	EDGE_THICKNESS,
	CONTENT_PADDING,
	BACKGROUND_COLOR,
	BODY_TEXT_COLOR,
	MARKET_ORDER,
	MARKET_COLORS,
	MARKET_PILL_BACKGROUNDS,
	MARKET_INACTIVE_COLOR,
	MARKET_LABEL_GAP,
	MARKET_PILL_GAP
} = require('./utils/constants');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { paintEdgesAndDividers } = require('./utils/edgePainter');
const MARKET_LABEL_FONT = '700 20px "Roboto Mono", "Courier New", monospace';
const BLANK_SCORE_WIDTH_TOKEN = '\u2007\u2007\u2007\u2007\u2007\u2007';

async function main() {
	const csvPath = path.resolve(__dirname, '../data/features.csv');
	const outputDir = path.resolve(__dirname, '../outputs/features');

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
	const edgeOptions = isBlank ? { edgeColorOverride: '#ffffff' } : undefined;
	paintEdgesAndDividers(ctx, record, edgeOptions);
	paintFeatureContent(ctx, record, { isBlank });

	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

function paintBackground(ctx) {
	ctx.fillStyle = BACKGROUND_COLOR;
	ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

	ctx.strokeStyle = '#d4cdc3';
	ctx.lineWidth = 4;
	ctx.strokeRect(EDGE_THICKNESS / 2, EDGE_THICKNESS / 2, CARD_SIZE - EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
}

function paintFeatureContent(ctx, record, { isBlank = false } = {}) {
	const safeZoneLeft = EDGE_THICKNESS + CONTENT_PADDING;
	const safeZoneRight = CARD_SIZE - EDGE_THICKNESS - CONTENT_PADDING;
	const headerBottom = paintHeaderRow(ctx, record, safeZoneLeft, safeZoneRight, { isBlank });
	if (isBlank) {
		return;
	}

	const title = (record.Title || 'Untitled Feature').trim();
	ctx.fillStyle = BODY_TEXT_COLOR;
	ctx.font = '700 30px "Noto Sans", "Montserrat", sans-serif';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.fillText(title, safeZoneLeft, headerBottom + 16);

	let cursorY = headerBottom + 60;
	ctx.fillStyle = BODY_TEXT_COLOR;
	ctx.font = '500 19px "Noto Sans", "Montserrat", sans-serif';
	const description = record['Text (SA - Special Ability; OC - On Completion)'] || record.Text || '';
	cursorY = drawTextBlock(ctx, description, {
		x: safeZoneLeft,
		y: cursorY,
		maxWidth: safeZoneRight - safeZoneLeft,
		lineHeight: 26,
		blankLineHeight: 24
	});

	const funny = record['Funny text'];
	if (funny && funny.trim()) {
		cursorY += 18;
		ctx.font = 'italic 500 18px "Noto Sans", "Montserrat", sans-serif';
		ctx.fillStyle = '#5c4d40';
		drawTextBlock(ctx, funny, {
			x: safeZoneLeft,
			y: cursorY,
			maxWidth: safeZoneRight - safeZoneLeft,
			lineHeight: 22,
			blankLineHeight: 20
		});
	}
}

function paintHeaderRow(ctx, record, safeZoneLeft, safeZoneRight, { isBlank = false } = {}) {
	const markets = parseMarkets(record);
	const scoreValue = isBlank ? '' : formatScore(record['Score Points']);
	const pillMeasurementValue = isBlank ? BLANK_SCORE_WIDTH_TOKEN : scoreValue;
	const pillMetrics = measureScorePill(ctx, pillMeasurementValue);
	const marketBottom = isBlank
		? EDGE_THICKNESS + 12
		: drawMarketRow(ctx, markets, safeZoneLeft, safeZoneRight, pillMetrics.width);
	const scoreBottom = drawScorePill(ctx, scoreValue, safeZoneRight, pillMetrics, { isBlank });
	return Math.max(marketBottom, scoreBottom);
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
		return String(value ?? '0');
	}
	return numeric > 0 ? `+${numeric}` : `${numeric}`;
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

function drawMarketRow(ctx, markets, safeZoneLeft, safeZoneRight, pillWidth) {
	const rowTop = EDGE_THICKNESS + 12;
	const rowHeight = 36;
	const highlights = new Set(markets);
	const maxRowRight = safeZoneRight - pillWidth - MARKET_PILL_GAP;
	let cursorX = safeZoneLeft;

	ctx.save();
	ctx.font = MARKET_LABEL_FONT;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';

	MARKET_ORDER.forEach((market, index) => {
		cursorX = Math.min(cursorX, maxRowRight);
		const isActive = highlights.has(market);
		const color = isActive ? MARKET_COLORS[market] || BODY_TEXT_COLOR : MARKET_INACTIVE_COLOR;
		const text = market;
		const labelWidth = ctx.measureText(text).width;
		if (isActive) {
			const pillPaddingX = 8;
			const pillPaddingY = 4;
			const pillRadius = 8;
			const pillTop = rowTop - pillPaddingY;
			const pillLeft = cursorX - pillPaddingX;
			const pillWidth = labelWidth + pillPaddingX * 2;
			const pillHeight = 24 + pillPaddingY * 2;
			ctx.fillStyle = MARKET_PILL_BACKGROUNDS[market] || '#f5f1eb';
			drawRoundedRect(ctx, pillLeft, pillTop, pillWidth, pillHeight, pillRadius);
		}
		ctx.fillStyle = color;
		ctx.fillText(text, cursorX, rowTop);
		const underlineY = rowTop + 24;
		ctx.strokeStyle = color;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(cursorX, underlineY);
		ctx.lineTo(cursorX + labelWidth, underlineY);
		ctx.stroke();
		cursorX += labelWidth + (index === MARKET_ORDER.length - 1 ? MARKET_PILL_GAP : MARKET_LABEL_GAP);
	});

	ctx.restore();
	return rowTop + rowHeight;
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
		ctx.font = '700 24px "Montserrat", sans-serif';
		ctx.fillText(scoreValue, pillX + metrics.width / 2, pillY + metrics.height / 2);
	}

	return pillY + metrics.height;
}

function parseMarkets(record) {
	const raw = String(record.Markets ?? '').trim();
	if (!raw) {
		return [];
	}

	const tokens = raw.split(',').map((token) => normalizeMarketName(token)).filter(Boolean);
	const seen = new Set();
	const normalized = [];
	tokens.forEach((market) => {
		if (seen.has(market)) {
			return;
		}
		seen.add(market);
		normalized.push(market);
	});
	return normalized;
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

function normalizeMarketName(value = '') {
	const upper = String(value).trim().toUpperCase();
	switch (upper) {
		case 'B2B':
			return 'B2B';
		case 'AI':
			return 'AI';
		case 'DATING':
			return 'Dating';
		case 'SAAS':
			return 'SaaS';
		default:
			return null;
	}
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
