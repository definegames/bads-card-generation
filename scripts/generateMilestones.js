#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');

const CARD_SIZE = 490;
const EDGE_THICKNESS = 40;
const CONTENT_PADDING = 30;
const BACKGROUND_COLOR = '#fdf7f2';
const BODY_TEXT_COLOR = '#1f1f1f';
const EDGE_COLORS = {
	A: '#ff6b6b',
	B: '#4ecdc4',
	C: '#ffd166'
};
const STRIPE_COLORS = [EDGE_COLORS.A, EDGE_COLORS.B, EDGE_COLORS.C];
const TIER_COLORS = {
	0: '#b4bcc6',
	1: '#6dd19c',
	2: '#ffb169',
	3: '#ff6b6b'
};

async function main() {
	const csvPath = path.resolve(__dirname, '../data/milestones.csv');
	const outputDir = path.resolve(__dirname, '../outputs/milestones');

	await fs.rm(outputDir, { recursive: true, force: true });
	await fs.mkdir(outputDir, { recursive: true });

	const csvRaw = await fs.readFile(csvPath, 'utf8');
	const milestones = parse(csvRaw, {
		columns: true,
		skip_empty_lines: true,
		relax_quotes: true
	});

	await Promise.all(
		milestones.map(async (record) => {
			const baseName = sanitizeFileName(record.ID || record.Title || 'card');

			const frontCanvas = createCanvas(CARD_SIZE, CARD_SIZE);
			const frontCtx = frontCanvas.getContext('2d');
			paintBackground(frontCtx);
			paintEdges(frontCtx, record);
			paintCopy(frontCtx, record);
			const frontPath = path.join(outputDir, `${baseName}.png`);
			await fs.writeFile(frontPath, frontCanvas.toBuffer('image/png'));

			const backCanvas = createCanvas(CARD_SIZE, CARD_SIZE);
			const backCtx = backCanvas.getContext('2d');
			paintBack(backCtx, record);
			const backPath = path.join(outputDir, `${withBackPrefix(baseName)}.png`);
			await fs.writeFile(backPath, backCanvas.toBuffer('image/png'));
		})
	);

	console.log(`Generated ${milestones.length * 2} milestone card face/back images in ${outputDir}`);
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

function paintEdges(ctx, record) {
	const edges = [
		{ key: 'North edge', position: 'north' },
		{ key: 'East edge', position: 'east' },
		{ key: 'South edge', position: 'south' },
		{ key: 'West edge', position: 'west' }
	];

	edges.forEach(({ key, position }) => {
		const value = (record[key] || '').trim();
		if (!value) return;
		drawEdge(ctx, position, value);
	});

	// Draw diagonal dividers at corners
	drawCornerDividers(ctx);
}

function drawCornerDividers(ctx) {
	const dividerColor = '#333';
	ctx.save();
	ctx.strokeStyle = dividerColor;
	ctx.lineWidth = 4;
	const lines = [
		[
			{ x: 0, y: 0 },
			{ x: EDGE_THICKNESS, y: EDGE_THICKNESS }
		],
		[
			{ x: CARD_SIZE - EDGE_THICKNESS, y: EDGE_THICKNESS },
			{ x: CARD_SIZE, y: 0 }
		],
		[
			{ x: 0, y: CARD_SIZE },
			{ x: EDGE_THICKNESS, y: CARD_SIZE - EDGE_THICKNESS }
		],
		[
			{ x: CARD_SIZE - EDGE_THICKNESS, y: CARD_SIZE - EDGE_THICKNESS },
			{ x: CARD_SIZE, y: CARD_SIZE }
		]
	];

	lines.forEach(([start, end]) => {
		ctx.beginPath();
		ctx.moveTo(start.x, start.y);
		ctx.lineTo(end.x, end.y);
		ctx.stroke();
	});
	ctx.restore();
}

function drawEdge(ctx, position, code) {
	const rect = edgeRect(position);
	withEdgeClip(ctx, position, () => {
		if (code === '*') {
			drawStripedEdge(ctx, rect, position);
			return;
		}

		const color = EDGE_COLORS[code] || '#cbd5e0';
		ctx.fillStyle = color;
		ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
	});
}

function drawStripedEdge(ctx, rect, position) {
	// Draw stripes as 10px wide, repeating, with diagonal dividers at corners
	const stripeWidth = 10;
	const stripesCount = Math.ceil((position === 'north' || position === 'south' ? rect.width : rect.height) / stripeWidth);
	for (let i = 0; i < stripesCount; i++) {
		const color = STRIPE_COLORS[i % STRIPE_COLORS.length];
		ctx.fillStyle = color;
		if (position === 'north') {
			ctx.fillRect(rect.x + i * stripeWidth, rect.y, stripeWidth, rect.height);
		} else if (position === 'south') {
			ctx.fillRect(rect.x + i * stripeWidth, rect.y, stripeWidth, rect.height);
		} else if (position === 'east') {
			ctx.fillRect(rect.x, rect.y + i * stripeWidth, rect.width, stripeWidth);
		} else if (position === 'west') {
			ctx.fillRect(rect.x, rect.y + i * stripeWidth, rect.width, stripeWidth);
		}
	}
}

function withEdgeClip(ctx, position, drawFn) {
	ctx.save();
	ctx.beginPath();
	createEdgePath(ctx, position);
	ctx.closePath();
	ctx.clip();
	drawFn();
	ctx.restore();
}

function createEdgePath(ctx, position) {
	switch (position) {
		case 'north':
			ctx.moveTo(0, 0);
			ctx.lineTo(CARD_SIZE, 0);
			ctx.lineTo(CARD_SIZE - EDGE_THICKNESS, EDGE_THICKNESS);
			ctx.lineTo(EDGE_THICKNESS, EDGE_THICKNESS);
			break;
		case 'south':
			ctx.moveTo(EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
			ctx.lineTo(CARD_SIZE - EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
			ctx.lineTo(CARD_SIZE, CARD_SIZE);
			ctx.lineTo(0, CARD_SIZE);
			break;
		case 'east':
			ctx.moveTo(CARD_SIZE - EDGE_THICKNESS, EDGE_THICKNESS);
			ctx.lineTo(CARD_SIZE, 0);
			ctx.lineTo(CARD_SIZE, CARD_SIZE);
			ctx.lineTo(CARD_SIZE - EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
			break;
		case 'west':
			ctx.moveTo(0, 0);
			ctx.lineTo(EDGE_THICKNESS, EDGE_THICKNESS);
			ctx.lineTo(EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
			ctx.lineTo(0, CARD_SIZE);
			break;
		default:
			throw new Error(`Unknown edge position for clip path: ${position}`);
	}
}

function edgeRect(position) {
	switch (position) {
		case 'north':
			return { x: 0, y: 0, width: CARD_SIZE, height: EDGE_THICKNESS };
		case 'south':
			return { x: 0, y: CARD_SIZE - EDGE_THICKNESS, width: CARD_SIZE, height: EDGE_THICKNESS };
		case 'east':
			return { x: CARD_SIZE - EDGE_THICKNESS, y: 0, width: EDGE_THICKNESS, height: CARD_SIZE };
		case 'west':
			return { x: 0, y: 0, width: EDGE_THICKNESS, height: CARD_SIZE };
		default:
			throw new Error(`Unknown edge position: ${position}`);
	}
}

function paintCopy(ctx, record) {
	const safeZoneLeft = EDGE_THICKNESS + CONTENT_PADDING;
	const safeZoneRight = CARD_SIZE - EDGE_THICKNESS - CONTENT_PADDING;
	const contentWidth = safeZoneRight - safeZoneLeft;

	// Title (smaller font)
	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';
	ctx.fillStyle = BODY_TEXT_COLOR;
	ctx.font = '700 28px "Noto Sans", "Montserrat", sans-serif';
	ctx.fillText((record.Title || '').trim(), CARD_SIZE / 2, EDGE_THICKNESS + 16);

	// Divider line
	ctx.strokeStyle = '#d9cbbd';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(safeZoneLeft, EDGE_THICKNESS + 56);
	ctx.lineTo(safeZoneRight, EDGE_THICKNESS + 56);
	ctx.stroke();

	// Body copy (smaller font)
	ctx.textAlign = 'left';
	ctx.font = '500 18px "Noto Sans", "Montserrat", sans-serif';

	let cursorY = EDGE_THICKNESS + 70;
	cursorY = drawTextBlock(ctx, record.Text, {
		x: safeZoneLeft,
		y: cursorY,
		maxWidth: contentWidth,
		lineHeight: 24,
		blankLineHeight: 22
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

function paintBack(ctx, record) {
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

	ctx.textBaseline = 'middle';
	ctx.fillStyle = accent;
	ctx.font = '800 200px "Montserrat", sans-serif';
	ctx.fillText(String(tier), CARD_SIZE / 2, CARD_SIZE / 2 + 40);

	ctx.textBaseline = 'bottom';
	ctx.fillStyle = '#675748';
	ctx.font = '600 28px "Noto Sans", "Montserrat", sans-serif';
	ctx.fillText(`Tier ${tier}`, CARD_SIZE / 2, CARD_SIZE - EDGE_THICKNESS - 20);
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
