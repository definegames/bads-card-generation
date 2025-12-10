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
	TIER_COLORS
} = require('./utils/constants');
const { paintEdgesAndDividers } = require('./utils/edgePainter');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { resolveOutputPath } = require('./utils/runtimeConfig');
const { getLocalizedText } = require('./utils/textHelpers');

async function main() {
	const csvPath = path.resolve(__dirname, '../data/milestones.csv');
	const outputDir = resolveOutputPath('milestones');

	await fs.rm(outputDir, { recursive: true, force: true });
	await fs.mkdir(outputDir, { recursive: true });

	const csvRaw = await fs.readFile(csvPath, 'utf8');
	const milestones = parse(csvRaw, {
		columns: true,
		skip_empty_lines: true,
		relax_quotes: true
	});

	const filteredMilestones = milestones.filter((record) => !shouldIgnoreRecord(record));

	await Promise.all(
		filteredMilestones.map(async (record) => {
			const baseName = sanitizeFileName(record.ID || record.Title || 'card');

			const frontPath = path.join(outputDir, `${baseName}.png`);
			await drawMilestoneFront(frontPath, record);

			const backPath = path.join(outputDir, `${withBackPrefix(baseName)}.png`);
			await drawMilestoneBack(backPath, record);
		})
	);

	console.log(`Generated ${filteredMilestones.length * 2} milestone card face/back images in ${outputDir}`);
}

function sanitizeFileName(value) {
	return value.replace(/[^a-z0-9._-]+/gi, '_');
}

function withBackPrefix(baseName) {
	return `back-${baseName}`;
}

function paintBackground(ctx) {
	ctx.fillStyle = BACKGROUND_COLOR;
	ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

	ctx.strokeStyle = '#d4cdc3';
	ctx.lineWidth = 4;
	ctx.strokeRect(EDGE_THICKNESS / 2, EDGE_THICKNESS / 2, CARD_SIZE - EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
}


async function drawMilestoneFront(filePath, record, options = {}) {
	const canvas = createCanvas(CARD_SIZE, CARD_SIZE);
	const ctx = canvas.getContext('2d');
	const isBlank = options.blank === true || record.__blank === true;
	paintBackground(ctx);
	const edgeOptions = isBlank ? { edgeColorOverride: '#ffffff' } : undefined;
	paintEdgesAndDividers(ctx, record, edgeOptions);
	paintCopy(ctx, record, { isBlank });
	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

async function drawMilestoneBack(filePath, record, options = {}) {
	const canvas = createCanvas(CARD_SIZE, CARD_SIZE);
	const ctx = canvas.getContext('2d');
	const isBlank = options.blank === true || record.__blank === true;
	paintBack(ctx, record, { isBlank });
	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

function paintCopy(ctx, record, { isBlank = false } = {}) {
	const safeZoneLeft = EDGE_THICKNESS + CONTENT_PADDING;
	const safeZoneRight = CARD_SIZE - EDGE_THICKNESS - CONTENT_PADDING;
	const contentWidth = safeZoneRight - safeZoneLeft;

// Title (smaller font)
	if (!isBlank) {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillStyle = BODY_TEXT_COLOR;
		ctx.font = '700 28px "Noto Sans", "Montserrat", sans-serif';
		ctx.fillText((record.Title || '').trim(), CARD_SIZE / 2, EDGE_THICKNESS + 16);
	}

	// Divider line
	ctx.strokeStyle = '#d9cbbd';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(safeZoneLeft, EDGE_THICKNESS + 56);
	ctx.lineTo(safeZoneRight, EDGE_THICKNESS + 56);
	ctx.stroke();

	if (isBlank) {
		return;
	}

	// Body copy (smaller font)
	ctx.textAlign = 'left';
	const bodyFont = '500 18px "Noto Sans", "Montserrat", sans-serif';
	ctx.font = bodyFont;

	let cursorY = EDGE_THICKNESS + 70;
	const tierCallout = getTierCallout(record);
	const bodyLineHeight = 24;
	const blankLineHeight = 22;
	if (tierCallout) {
		ctx.font = '700 18px "Noto Sans", "Montserrat", sans-serif';
		ctx.fillText(tierCallout, safeZoneLeft, cursorY);
		cursorY += bodyLineHeight;
		cursorY += blankLineHeight;
		ctx.font = bodyFont;
	}
	const bodyCopy = getLocalizedText(record, ['Text']);
	cursorY = drawTextBlock(ctx, bodyCopy, {
		x: safeZoneLeft,
		y: cursorY,
		maxWidth: contentWidth,
		lineHeight: bodyLineHeight,
		blankLineHeight
	});

	const stats = buildStats(record);
	if (stats.length) {
		cursorY += 30;
		ctx.font = '600 16px "Noto Sans", "Montserrat", sans-serif';
		ctx.fillStyle = '#3a3028';
		cursorY = drawStats(ctx, stats, safeZoneLeft, cursorY, contentWidth);
	}

	const funny = record['Funny text'];
	if (funny && funny.trim()) {
		cursorY += 18;
		ctx.font = 'italic 500 18px "Noto Sans", "Montserrat", sans-serif';
		cursorY = drawTextBlock(ctx, funny, {
			x: safeZoneLeft,
			y: cursorY,
			maxWidth: contentWidth,
			lineHeight: 22,
			blankLineHeight: 20
		});
	}
}

function getTierCallout(record) {
	const tier = Number(record.Tier ?? 0);
	switch (tier) {
		case 1:
			return 'Regroup';
		case 2:
			return 'Pivot';
		case 3:
			return 'You win!';
		default:
			return '';
	}
}

function paintBack(ctx, record, { isBlank = false } = {}) {
	const tier = Number(record.Tier ?? 0);
	const accent = TIER_COLORS[tier] || TIER_COLORS[0];

	ctx.fillStyle = '#fbf4ec';
	ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

	ctx.strokeStyle = '#d4cdc3';
	ctx.lineWidth = 4;
	ctx.strokeRect(EDGE_THICKNESS / 2, EDGE_THICKNESS / 2, CARD_SIZE - EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);

	const gradient = ctx.createRadialGradient(
		CARD_SIZE / 2,
		CARD_SIZE / 2,
		40,
		CARD_SIZE / 2,
		CARD_SIZE / 2,
		CARD_SIZE / 2
	);
	gradient.addColorStop(0, `${accent}33`);
	gradient.addColorStop(1, '#ffffff00');
	ctx.fillStyle = gradient;
	ctx.fillRect(EDGE_THICKNESS, EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS * 2, CARD_SIZE - EDGE_THICKNESS * 2);

	ctx.fillStyle = '#3a3028';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';
	ctx.font = '700 40px "Noto Sans", "Montserrat", sans-serif';
	ctx.fillText('Milestone', CARD_SIZE / 2, EDGE_THICKNESS + 20);

	if (!isBlank) {
		ctx.textBaseline = 'middle';
		ctx.fillStyle = accent;
		ctx.font = '800 200px "Montserrat", sans-serif';
		ctx.fillText(String(tier), CARD_SIZE / 2, CARD_SIZE / 2 + 40);

		ctx.textBaseline = 'bottom';
		ctx.fillStyle = '#675748';
		ctx.font = '600 28px "Noto Sans", "Montserrat", sans-serif';
		ctx.fillText(`Tier ${tier}`, CARD_SIZE / 2, CARD_SIZE - EDGE_THICKNESS - 20);
	}
}

function buildStats(record) {
	const mapping = [
		{ key: 'TCF', label: 'Completed Features' },
		{ key: 'ACF', label: 'Adjacent Features' },
		{ key: 'MTS', label: 'Total Product Score' }
	];

	return mapping
		.map(({ key, label }) => {
			const value = Number(record[key] ?? 0);
			if (!value) return null;
			return `${label}: ${value}+`;
		})
		.filter(Boolean);
}

function drawStats(ctx, stats, x, startY, maxWidth) {
	const lineHeight = 22;
	const verticalGap = 4;
	const paddingX = 12;
	const paddingY = 10;
	ctx.save();
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';

	const contentHeight = stats.length * lineHeight + (stats.length - 1) * verticalGap;
	const backgroundHeight = contentHeight + paddingY * 2;
	ctx.fillStyle = '#f1e3d4';
	ctx.beginPath();
	const radius = 10;
	const bgLeft = x - paddingX;
	const bgTop = startY - paddingY;
	const bgRight = x + maxWidth + paddingX;
	const bgBottom = bgTop + backgroundHeight;
	ctx.moveTo(bgLeft + radius, bgTop);
	ctx.lineTo(bgRight - radius, bgTop);
	ctx.quadraticCurveTo(bgRight, bgTop, bgRight, bgTop + radius);
	ctx.lineTo(bgRight, bgBottom - radius);
	ctx.quadraticCurveTo(bgRight, bgBottom, bgRight - radius, bgBottom);
	ctx.lineTo(bgLeft + radius, bgBottom);
	ctx.quadraticCurveTo(bgLeft, bgBottom, bgLeft, bgBottom - radius);
	ctx.lineTo(bgLeft, bgTop + radius);
	ctx.quadraticCurveTo(bgLeft, bgTop, bgLeft + radius, bgTop);
	ctx.closePath();
	ctx.fill();

	ctx.fillStyle = '#3a3028';
	ctx.font = '600 16px "Noto Sans", "Montserrat", sans-serif';

	let cursorY = startY;
	stats.forEach((stat) => {
		ctx.fillText(stat, x, cursorY);
		cursorY += lineHeight + verticalGap;
	});
	cursorY -= verticalGap; // remove extra gap after last entry
	ctx.restore();
	return cursorY + 6;
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
		console.error('Failed to generate milestone cards:', error);
		process.exitCode = 1;
	});
}

module.exports = {
	drawMilestoneFront,
	drawMilestoneBack
};
