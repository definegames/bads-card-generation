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
	CATEGORY_COLORS,
	TICKET_CARD_SIZE,
	SMALL_CARD_SCALE,
	TICKET_DIRECTIVE_COLORS
} = require('./utils/constants');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { resolveOutputPath } = require('./utils/runtimeConfig');
const { getLocalizedText } = require('./utils/textHelpers');

const DIRECTIVE_ICON_STYLES = [
	{ marker: '[Open]:', letter: 'O', color: TICKET_DIRECTIVE_COLORS.open },
	{ marker: '[Close]:', letter: 'C', color: TICKET_DIRECTIVE_COLORS.close },
	{ marker: '[Action]:', letter: 'A', color: TICKET_DIRECTIVE_COLORS.action }
];
const s = (value) => Math.round(value * SMALL_CARD_SCALE);
const DIRECTIVE_ICON_SIZE = s(34);
const DIRECTIVE_ICON_GAP = s(14);

async function main() {
	const csvPath = path.resolve(__dirname, '../data/tickets.csv');
	const outputDir = resolveOutputPath('tickets');

	await fs.mkdir(outputDir, { recursive: true });

	const csvRaw = await fs.readFile(csvPath, 'utf8');
	const tickets = parse(csvRaw, {
		columns: true,
		skip_empty_lines: true,
		relax_quotes: true
	}).filter((record) => !shouldIgnoreRecord(record));

	const tasks = [];
	for (const ticket of tickets) {
		const copies = normalizeCopies(ticket.Copies);
		const baseId = buildFileSlug(ticket);
		for (let i = 0; i < copies; i++) {
			const suffix = copies > 1 ? `-copy${i + 1}` : '';
			const targetPath = path.join(outputDir, `${baseId}${suffix}.png`);
			tasks.push(drawTicketCard(targetPath, ticket));
		}
	}

	await Promise.all(tasks);

	console.log(`Generated ${tasks.length} ticket cards in ${outputDir}`);
}

async function drawTicketCard(filePath, record, options = {}) {
	const isBlank = options.blank === true || record.__blank === true;
	const canvas = createCanvas(TICKET_CARD_SIZE, TICKET_CARD_SIZE);
	const ctx = canvas.getContext('2d');

	paintBackground(ctx, record);
	paintTicket(ctx, record, { isBlank });

	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

function paintBackground(ctx, record) {
	ctx.fillStyle = '#fffdf8';
	ctx.fillRect(0, 0, TICKET_CARD_SIZE, TICKET_CARD_SIZE);

	const category = String(record?.Category || '').trim().toUpperCase();
	const categoryColors = CATEGORY_COLORS[category] || { background: '#edf2f7', foreground: '#2d3748' };

	// Thin edge outline using the category tag color.
	ctx.strokeStyle = categoryColors.foreground;
	ctx.lineWidth = Math.max(1, s(1));
	drawRoundedRectPath(ctx, 0.5, 0.5, TICKET_CARD_SIZE - 1, TICKET_CARD_SIZE - 1, s(12));
	ctx.stroke();

	// Replace the old beige border with the category tag color.
	ctx.strokeStyle = categoryColors.foreground;
	ctx.lineWidth = s(6);
	// Rounded inner border so corners are inset/rounded.
	drawRoundedRectPath(ctx, s(2), s(2), TICKET_CARD_SIZE - s(4), TICKET_CARD_SIZE - s(4), s(14));
	ctx.stroke();
}

function paintTicket(ctx, record, { isBlank = false } = {}) {
	const padding = s(24);
	const safeLeft = padding;
	const safeRight = TICKET_CARD_SIZE - padding;
	const contentWidth = safeRight - safeLeft;

	const category = (record.Category || 'ERROR!!!').trim().toUpperCase();
	const categoryColors = CATEGORY_COLORS[category] || { background: '#edf2f7', foreground: '#2d3748' };

	const badgeY = padding - s(8);
	if (!isBlank) {
		ctx.font = `700 ${s(18)}px "Inter", "Noto Color Emoji", "Noto Sans", "Montserrat", sans-serif`;
		const badgeWidth = ctx.measureText(category).width + s(24);
		ctx.fillStyle = categoryColors.background;
		drawRoundedRect(ctx, safeLeft, badgeY, badgeWidth, s(32), s(10));
		ctx.fillStyle = categoryColors.foreground;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(category, safeLeft + s(12), badgeY + s(16));
	}

	const title = (record.Title || 'Ticket').trim();
	if (!isBlank) {
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.fillStyle = BODY_TEXT_COLOR;
		ctx.font = `600 ${s(24)}px "Inter", "Noto Color Emoji", "Noto Sans", "Montserrat", sans-serif`;
		ctx.fillText(title, safeLeft, badgeY + s(44));
	}

	const slotsTop = badgeY + s(90);
	const slotResult = isBlank ? { rows: 0, height: 0 } : paintCounterSlots(ctx, record, safeLeft, slotsTop, contentWidth);
	const slotRows = slotResult.rows;
	const slotHeight = slotResult.height;

	const slotBlockBottom = slotRows ? slotsTop + slotHeight + s(18) : slotsTop;
	const dividerY = slotBlockBottom + s(6);
	ctx.strokeStyle = '#e8d9cc';
	ctx.lineWidth = s(2);
	ctx.beginPath();
	ctx.moveTo(safeLeft, dividerY);
	ctx.lineTo(safeRight, dividerY);
	ctx.stroke();

	if (isBlank) {
		return;
	}

	let cursorY = dividerY + s(18);
	const text = getLocalizedText(record, ['Text']);
	if (text.trim()) {
		ctx.font = `500 ${s(18)}px "Inter", "Noto Color Emoji", "Noto Sans", "Montserrat", sans-serif`;
		cursorY = drawTextBlock(ctx, text, {
			x: safeLeft,
			y: cursorY,
			maxWidth: contentWidth,
			lineHeight: s(24),
			blankLineHeight: s(22),
			renderDirectiveIcons: true
		});
	}

	const funny = record['Funny text'];
	if (funny && funny.trim()) {
		cursorY += s(16);
		ctx.font = `italic 500 ${s(16)}px "Inter", "Noto Color Emoji", "Noto Sans", "Montserrat", sans-serif`;
		ctx.fillStyle = '#574334';
		drawTextBlock(ctx, funny, {
			x: safeLeft,
			y: cursorY,
			maxWidth: contentWidth,
			lineHeight: s(22),
			blankLineHeight: s(18)
		});
	}
}

function paintCounterSlots(ctx, record, left, top, maxWidth) {
	const slotSymbol = (record['Slot type'] || '▢').trim() || '▢';
	const slotCount = Math.max(0, Number(record['Counter slots'] ?? 0));
	if (!slotCount) {
		return { rows: 0, height: 0 };
	}

	const slotsPerRow = 6;
	const glyphSize = s(32);
	const rowSpacing = glyphSize + s(14);
	const gutter = glyphSize * 0.5;
	const startX = left + gutter;
	const endX = left + Math.max(maxWidth - gutter, gutter);
	const usableWidth = Math.max(endX - startX, 1);
	const columnSpacing = usableWidth / (slotsPerRow - 1);

	ctx.font = `600 ${glyphSize}px "Inter", "Noto Color Emoji", "Noto Sans", "Montserrat", sans-serif`;
	ctx.fillStyle = '#4b372a';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	let rows = 0;
	for (let i = 0; i < slotCount; i++) {
		const columnIndex = i % slotsPerRow;
		const rowIndex = Math.floor(i / slotsPerRow);
		const x = startX + columnSpacing * columnIndex;
		const y = top + rowIndex * rowSpacing + glyphSize / 2;
		ctx.fillText(slotSymbol, x, y);
		rows = Math.max(rows, rowIndex + 1);
	}

	const height = rows ? (rows - 1) * rowSpacing + glyphSize : 0;
	return { rows, height };
}

function drawTextBlock(ctx, raw = '', options) {
	const { x, y, maxWidth, lineHeight, blankLineHeight = lineHeight, renderDirectiveIcons = false } = options;
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
	ctx.fillStyle = BODY_TEXT_COLOR;

	lines.forEach((line) => {
		if (!line.trim()) {
			cursorY += blankLineHeight;
			return;
		}

		const directiveInfo = renderDirectiveIcons ? extractDirectiveInfo(line) : null;
		if (directiveInfo) {
			const indent = drawDirectiveIcon(ctx, directiveInfo, x, cursorY, lineHeight) + DIRECTIVE_ICON_GAP;
			const adjustedX = x + indent;
			const adjustedWidth = Math.max(maxWidth - indent, 10);
			cursorY = drawWrappedLine(ctx, directiveInfo.text || '', adjustedX, cursorY, adjustedWidth, lineHeight);
			return;
		}

		cursorY = drawWrappedLine(ctx, line, x, cursorY, maxWidth, lineHeight);
	});
	return cursorY;
}

function extractDirectiveInfo(line) {
	const trimmed = line.trimStart();
	for (const style of DIRECTIVE_ICON_STYLES) {
		if (trimmed.startsWith(style.marker)) {
			const text = trimmed.slice(style.marker.length).trimStart();
			return { ...style, text };
		}
	}
	return null;
}

function drawDirectiveIcon(ctx, style, x, y, lineHeight) {
	const radius = DIRECTIVE_ICON_SIZE / 2;
	const centerX = x + radius;
	const centerY = y + lineHeight / 2;
	ctx.save();
	ctx.fillStyle = style.color;
	ctx.beginPath();
	ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#fffdf8';
	ctx.font = `700 ${s(14)}px "Inter", "Noto Color Emoji", "Noto Sans", "Montserrat", sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(style.letter, centerX, centerY);
	ctx.restore();
	return DIRECTIVE_ICON_SIZE;
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

function drawRoundedRect(ctx, x, y, width, height, radius) {
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
	ctx.restore();
}

function drawRoundedRectPath(ctx, x, y, width, height, radius) {
	const r = Math.max(0, Math.min(radius, width / 2, height / 2));
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + width - r, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + r);
	ctx.lineTo(x + width, y + height - r);
	ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
	ctx.lineTo(x + r, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
}

function normalizeCopies(value) {
	const numeric = Number(value);
	if (!Number.isFinite(numeric) || numeric < 1) {
		return 1;
	}
	return Math.floor(numeric);
}

function buildFileSlug(record) {
	const category = (record.Category || 'ticket').trim().toUpperCase();
	const baseTitle = (record.Title || 'ticket').trim();
	return `${category}.${baseTitle}`.replace(/[^a-z0-9._-]+/gi, '_');
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to generate ticket cards:', error);
		process.exitCode = 1;
	});
}

module.exports = {
	drawTicketCard
};
