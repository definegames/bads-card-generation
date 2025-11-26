#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');
const {
	EDGE_THICKNESS,
	CONTENT_PADDING,
	BODY_TEXT_COLOR,
	CATEGORY_COLORS,
	TICKET_CARD_SIZE
} = require('./utils/constants');

async function main() {
	const csvPath = path.resolve(__dirname, '../data/tickets.csv');
	const outputDir = path.resolve(__dirname, '../outputs/tickets');

	await fs.rm(outputDir, { recursive: true, force: true });
	await fs.mkdir(outputDir, { recursive: true });

	const csvRaw = await fs.readFile(csvPath, 'utf8');
	const tickets = parse(csvRaw, {
		columns: true,
		skip_empty_lines: true,
		relax_quotes: true
	});

	const tasks = [];
	for (const ticket of tickets) {
		const copies = normalizeCopies(ticket.Copies);
		const baseId = buildFileSlug(ticket);
		for (let i = 0; i < copies; i++) {
			const suffix = copies > 1 ? `-copy${i + 1}` : '';
			const targetPath = path.join(outputDir, `${baseId}${suffix}.png`);
			tasks.push(renderTicket(targetPath, ticket));
		}
	}

	await Promise.all(tasks);

	console.log(`Generated ${tasks.length} ticket cards in ${outputDir}`);
}

async function renderTicket(filePath, record) {
	const canvas = createCanvas(TICKET_CARD_SIZE, TICKET_CARD_SIZE);
	const ctx = canvas.getContext('2d');

	paintBackground(ctx);
	paintTicket(ctx, record);

	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

function paintBackground(ctx) {
	ctx.fillStyle = '#fffdf8';
	ctx.fillRect(0, 0, TICKET_CARD_SIZE, TICKET_CARD_SIZE);

	ctx.strokeStyle = '#d9cbbd';
	ctx.lineWidth = 4;
	ctx.strokeRect(2, 2, TICKET_CARD_SIZE - 4, TICKET_CARD_SIZE - 4);
}

function paintTicket(ctx, record) {
	const padding = 24;
	const safeLeft = padding;
	const safeRight = TICKET_CARD_SIZE - padding;
	const contentWidth = safeRight - safeLeft;

	const category = (record.Category || 'NONE').trim().toUpperCase();
	const categoryColors = CATEGORY_COLORS[category] || { background: '#edf2f7', foreground: '#2d3748' };

	const badgeY = padding - 8;
	ctx.font = '700 18px "Montserrat", sans-serif';
	const badgeWidth = ctx.measureText(category).width + 24;
	ctx.fillStyle = categoryColors.background;
	drawRoundedRect(ctx, safeLeft, badgeY, badgeWidth, 32, 10);
	ctx.fillStyle = categoryColors.foreground;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	ctx.fillText(category, safeLeft + 12, badgeY + 16);

	const title = (record.Title || 'Ticket').trim();
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.fillStyle = BODY_TEXT_COLOR;
	ctx.font = '600 24px "Noto Sans", "Montserrat", sans-serif';
	ctx.fillText(title, safeLeft, badgeY + 44);

	const slotsTop = badgeY + 90;
	const { rows: slotRows, height: slotHeight } = paintCounterSlots(ctx, record, safeLeft, slotsTop, contentWidth);

	const slotBlockBottom = slotRows ? slotsTop + slotHeight + 18 : slotsTop;
	const dividerY = slotBlockBottom + 6;
	ctx.strokeStyle = '#e8d9cc';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(safeLeft, dividerY);
	ctx.lineTo(safeRight, dividerY);
	ctx.stroke();

	let cursorY = dividerY + 18;
	const text = record['Text (SA - Special Ability; WS - When Starting; OC - On Closing)'] || record.Text || '';
	if (text.trim()) {
		ctx.font = '500 18px "Noto Sans", "Montserrat", sans-serif';
		cursorY = drawTextBlock(ctx, text, {
			x: safeLeft,
			y: cursorY,
			maxWidth: contentWidth,
			lineHeight: 24,
			blankLineHeight: 22
		});
	}

	const funny = record['Funny text'];
	if (funny && funny.trim()) {
		cursorY += 16;
		ctx.font = 'italic 500 16px "Noto Sans", "Montserrat", sans-serif';
		ctx.fillStyle = '#574334';
		drawTextBlock(ctx, funny, {
			x: safeLeft,
			y: cursorY,
			maxWidth: contentWidth,
			lineHeight: 22,
			blankLineHeight: 18
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
	const glyphSize = 32;
	const rowSpacing = glyphSize + 14;
	const gutter = glyphSize * 0.5;
	const startX = left + gutter;
	const endX = left + Math.max(maxWidth - gutter, gutter);
	const usableWidth = Math.max(endX - startX, 1);
	const columnSpacing = usableWidth / (slotsPerRow - 1);

	ctx.font = `600 ${glyphSize}px "Montserrat", sans-serif`;
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
	ctx.fillStyle = BODY_TEXT_COLOR;

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
