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
	CATEGORY_COLORS
} = require('./utils/constants');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { paintEdgesAndDividers } = require('./utils/edgePainter');

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

async function drawFeatureCard(filePath, record) {
	const canvas = createCanvas(CARD_SIZE, CARD_SIZE);
	const ctx = canvas.getContext('2d');

	paintBackground(ctx);
	paintEdgesAndDividers(ctx, record);
	paintFeatureContent(ctx, record);

	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

function paintBackground(ctx) {
	ctx.fillStyle = BACKGROUND_COLOR;
	ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

	ctx.strokeStyle = '#d4cdc3';
	ctx.lineWidth = 4;
	ctx.strokeRect(EDGE_THICKNESS / 2, EDGE_THICKNESS / 2, CARD_SIZE - EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
}

function paintFeatureContent(ctx, record) {
	const safeZoneLeft = EDGE_THICKNESS + CONTENT_PADDING;
	const safeZoneRight = CARD_SIZE - EDGE_THICKNESS - CONTENT_PADDING;
	const headerBottom = paintHeaderRow(ctx, record, safeZoneLeft, safeZoneRight);

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

function paintHeaderRow(ctx, record, safeZoneLeft, safeZoneRight) {
	const category = (record.Category || 'ERROR!!!').trim().toUpperCase();
	const categoryColors = CATEGORY_COLORS[category] || { background: '#edf2f7', foreground: '#2d3748' };
	const badgeY = EDGE_THICKNESS + 12;
	const badgePaddingX = 14;
	const badgeHeight = 36;

	ctx.font = '700 18px "Montserrat", sans-serif';
	const badgeWidth = ctx.measureText(category || 'GENERAL').width + badgePaddingX * 2;
	ctx.fillStyle = categoryColors.background;
	drawRoundedRect(ctx, safeZoneLeft, badgeY, badgeWidth, badgeHeight, 12);

	ctx.fillStyle = categoryColors.foreground;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	ctx.fillText(category || 'GENERAL', safeZoneLeft + badgePaddingX, badgeY + badgeHeight / 2);

	const scoreValue = formatScore(record['Score Points']);
	const pillPaddingX = 18;
	const pillHeight = 44;
	ctx.font = '700 24px "Montserrat", sans-serif';
	const scoreValueWidth = ctx.measureText(scoreValue).width;
	const pillWidth = scoreValueWidth + pillPaddingX * 2;
	const pillX = safeZoneRight - pillWidth;
	const pillY = badgeY - 4;

	ctx.fillStyle = '#fff';
	ctx.strokeStyle = '#d8cbbb';
	ctx.lineWidth = 2;
	drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, 14, true);

	ctx.fillStyle = '#a0692b';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(scoreValue, pillX + pillWidth / 2, pillY + pillHeight / 2);

	return Math.max(badgeY + badgeHeight, pillY + pillHeight);
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

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to generate feature cards:', error);
		process.exitCode = 1;
	});
}
