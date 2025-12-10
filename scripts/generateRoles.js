#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');
const {
	EDGE_THICKNESS,
	CONTENT_PADDING,
	BODY_TEXT_COLOR,
	ROLE_CARD_HEIGHT,
	ROLE_CARD_WIDTH,
	ROLE_CARD_BACKGROUND,
	ROLE_ACCENT_COLOR
} = require('./utils/constants');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { resolveOutputPath } = require('./utils/runtimeConfig');
const { getLocalizedText } = require('./utils/textHelpers');

async function main() {
	const csvPath = path.resolve(__dirname, '../data/roles.csv');
	const outputDir = resolveOutputPath('roles');

	await fs.rm(outputDir, { recursive: true, force: true });
	await fs.mkdir(outputDir, { recursive: true });

	const csvRaw = await fs.readFile(csvPath, 'utf8');
	const roles = parse(csvRaw, {
		columns: true,
		skip_empty_lines: true,
		relax_quotes: true
	});

	const validRoles = roles.filter(
		(record) => Boolean((record.Title || '').trim()) && !shouldIgnoreRecord(record)
	);

	await Promise.all(
		validRoles.map(async (record) => {
			const title = (record.Title || 'Role').trim();
			const orderRaw = (record.Order || '').trim();
			const orderPrefix = orderRaw ? orderRaw.padStart(2, '0') : '00';
			const baseName = `${orderPrefix}.${sanitizeFileName(title)}`;
			const filePath = path.join(outputDir, `${baseName}.png`);
			await drawRoleCard(filePath, record);
		})
	);

	console.log(`Generated ${validRoles.length} role cards in ${outputDir}`);
}

async function drawRoleCard(filePath, record, options = {}) {
	const canvas = createCanvas(ROLE_CARD_WIDTH, ROLE_CARD_HEIGHT);
	const ctx = canvas.getContext('2d');
	paintBackground(ctx);
	paintRoleContent(ctx, record, { isBlank: options.blank === true || record.__blank === true });
	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

function paintBackground(ctx) {
	ctx.fillStyle = ROLE_CARD_BACKGROUND;
	ctx.fillRect(0, 0, ROLE_CARD_WIDTH, ROLE_CARD_HEIGHT);

	ctx.strokeStyle = '#d4cdc3';
	ctx.lineWidth = 4;
	ctx.strokeRect(
		EDGE_THICKNESS / 2,
		EDGE_THICKNESS / 2,
		ROLE_CARD_WIDTH - EDGE_THICKNESS,
		ROLE_CARD_HEIGHT - EDGE_THICKNESS
	);

	const gradient = ctx.createLinearGradient(0, 0, ROLE_CARD_WIDTH, ROLE_CARD_HEIGHT);
	gradient.addColorStop(0, `${ROLE_ACCENT_COLOR}10`);
	gradient.addColorStop(1, `${ROLE_ACCENT_COLOR}00`);
	ctx.fillStyle = gradient;
	ctx.fillRect(EDGE_THICKNESS, EDGE_THICKNESS, ROLE_CARD_WIDTH - EDGE_THICKNESS * 2, ROLE_CARD_HEIGHT - EDGE_THICKNESS * 2);
}

function paintRoleContent(ctx, record, { isBlank = false } = {}) {
	const safeLeft = EDGE_THICKNESS + CONTENT_PADDING;
	const safeRight = ROLE_CARD_WIDTH - EDGE_THICKNESS - CONTENT_PADDING;
	const contentWidth = safeRight - safeLeft;

	const title = (record.Title || 'Role').trim();
	const order = (record.Order || '').trim();

	const heroBottom = drawRoleNumber(ctx, order, isBlank);

	const titleY = heroBottom + 16;
	if (!isBlank) {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillStyle = BODY_TEXT_COLOR;
		ctx.font = '800 42px "Montserrat", sans-serif';
		ctx.fillText(title, ROLE_CARD_WIDTH / 2, titleY);
	}

	const dividerY = titleY + 52;
	ctx.strokeStyle = '#d9cbbd';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(safeLeft, dividerY);
	ctx.lineTo(safeRight, dividerY);
	ctx.stroke();

	if (isBlank) {
		return;
	}

	let cursorY = dividerY + 18;
	const text = getLocalizedText(record, ['Text']);
	if (text) {
		ctx.textAlign = 'left';
		ctx.font = '500 20px "Noto Sans", "Montserrat", sans-serif';
		cursorY = drawTextBlock(ctx, text, {
			x: safeLeft,
			y: cursorY,
			maxWidth: contentWidth,
			lineHeight: 28,
			blankLineHeight: 24
		});
	}

	const funny = (record['Funny text'] || '').trim();
	if (funny) {
		cursorY += 20;
		ctx.font = 'italic 500 18px "Noto Sans", "Montserrat", sans-serif';
		ctx.fillStyle = '#5c4d40';
		drawTextBlock(ctx, funny, {
			x: safeLeft,
			y: cursorY,
			maxWidth: contentWidth,
			lineHeight: 24,
			blankLineHeight: 20
		});
	}
}

function drawRoleNumber(ctx, order, isBlank) {
	const display = order ? order.padStart(2, '0') : '--';
	const centerY = EDGE_THICKNESS + 120;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = `${ROLE_ACCENT_COLOR}15`;
	ctx.font = '900 200px "Montserrat", sans-serif';
	if (!isBlank) {
		ctx.fillText(display, ROLE_CARD_WIDTH / 2, centerY);
	}

	ctx.fillStyle = ROLE_ACCENT_COLOR;
	ctx.font = '800 60px "Montserrat", sans-serif';
	if (!isBlank) {
		ctx.fillText(display, ROLE_CARD_WIDTH / 2, centerY);
	}

	return centerY + 80;
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
	ctx.textBaseline = 'top';
	ctx.textAlign = 'left';

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

function sanitizeFileName(value) {
	return value.replace(/[^a-z0-9._-]+/gi, '_');
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to generate role cards:', error);
		process.exitCode = 1;
	});
}

module.exports = {
	drawRoleCard
};
