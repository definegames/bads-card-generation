#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');
require('./utils/fontRegistry'); // Register fonts
const {
	BODY_TEXT_COLOR,
	TICKET_CARD_SIZE,
	SMALL_CARD_SCALE,
	TEXT_BLOCK_LINE_HEIGHT
} = require('./utils/constants');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { resolveOutputPath } = require('./utils/runtimeConfig');
const { getLocalizedText } = require('./utils/textHelpers');

const s = (value) => Math.round(value * SMALL_CARD_SCALE);
const TICKET_TEXT_LINE_HEIGHT = s(TEXT_BLOCK_LINE_HEIGHT);

const TICKET_BG_COLOR = '#ffffff';
const TICKET_CORNER_RADIUS = 50;
const TICKET_INSET_SHADOW = 10;

const CATEGORY_STYLES = {
	TECH: { text: '#4298ce', background: '#dbf1ff' },
	MARKETING: { text: '#c99320', background: '#ffe49a' },
	DESIGN: { text: '#c9208b', background: '#ffc5e1' }
};
const DEFAULT_CATEGORY_STYLE = { text: '#5f6b7a', background: '#e8edf3' };

const CATEGORY_PILL_X = 54;
const CATEGORY_PILL_Y = 47;
const CATEGORY_TEXT_X = 70;
const CATEGORY_TEXT_Y = 51;
const CATEGORY_TEXT_FONT = '700 36px "Inter", sans-serif';
const CATEGORY_PILL_RADIUS = 12;
const CATEGORY_PILL_HEIGHT = 52;
const CATEGORY_PILL_PADDING_X = 16;

const TITLE_X = 70;
const TITLE_Y = 128;
const TITLE_FONT = '500 48px "Inter", sans-serif';

const SLOT_START_X = 70;
const SLOT_Y = 252;
const SLOT_SIZE = 50;
const SLOT_RADIUS = 5;
const SLOT_X_POSITIONS = [70, 185, 300, 415, 530, 645];
const SLOT_BORDER_WIDTH = 3;
const SLOT_BORDER_COLOR = '#000000';
const MAX_SLOT_COUNT = 6;

const DIVIDER_X = 127;
const DIVIDER_Y = 383;
const DIVIDER_WIDTH = 513;
const DIVIDER_COLOR = '#a3a3a3';
const DIVIDER_LINE_WIDTH = 1;

const BODY_TEXT_X = 70;
const BODY_TEXT_Y = 481;
const BODY_TEXT_RIGHT_PADDING = 70;
const BODY_TEXT_WITH_ICON_X = 190;
const BODY_TEXT_FONT = `500 ${s(18)}px "Inter", sans-serif`;
const FUNNY_TEXT_GAP = s(16);
const FUNNY_TEXT_FONT = `italic 500 ${s(16)}px "Inter", sans-serif`;
const FUNNY_TEXT_COLOR = '#574334';

const DIRECTIVE_ICON_SIZE = 71;
const DIRECTIVE_ICON_X = 70;
const DIRECTIVE_ICON_TEXT_COLOR = '#ffffff';
const DIRECTIVE_ICON_TEXT_FONT = '900 48px "Inter", sans-serif';
const DIRECTIVE_ICON_STYLES = [
	{ marker: '[Open]:', letter: 'O', color: '#4c83c3' },
	{ marker: '[Close]:', letter: 'C', color: '#d02626' },
	{ marker: '[Action]:', letter: 'A', color: '#7ac34c' }
];

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
	const categoryStyle = resolveCategoryStyle(record);

	ctx.fillStyle = categoryStyle.background;
	ctx.fillRect(0, 0, TICKET_CARD_SIZE, TICKET_CARD_SIZE);

	ctx.fillStyle = TICKET_BG_COLOR;
	drawRoundedRect(
		ctx,
		TICKET_INSET_SHADOW,
		TICKET_INSET_SHADOW,
		TICKET_CARD_SIZE - TICKET_INSET_SHADOW * 2,
		TICKET_CARD_SIZE - TICKET_INSET_SHADOW * 2,
		TICKET_CORNER_RADIUS - TICKET_INSET_SHADOW
	);
}

function paintTicket(ctx, record, { isBlank = false } = {}) {
	const category = (record.Category || '').trim().toUpperCase();
	const categoryStyle = resolveCategoryStyle(record);
	if (!isBlank) {
		ctx.font = CATEGORY_TEXT_FONT;
		const pillWidth = ctx.measureText(category).width + CATEGORY_PILL_PADDING_X * 2;
		ctx.fillStyle = categoryStyle.background;
		drawRoundedRect(ctx, CATEGORY_PILL_X, CATEGORY_PILL_Y, pillWidth, CATEGORY_PILL_HEIGHT, CATEGORY_PILL_RADIUS);
		ctx.fillStyle = categoryStyle.text;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.fillText(category, CATEGORY_TEXT_X, CATEGORY_TEXT_Y);
	}

	const title = (record.Title || 'Ticket').trim();
	if (!isBlank) {
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.fillStyle = BODY_TEXT_COLOR;
		ctx.font = TITLE_FONT;
		ctx.fillText(title, TITLE_X, TITLE_Y);
	}

	paintWorkSlots(ctx, record, { isBlank });

	ctx.strokeStyle = DIVIDER_COLOR;
	ctx.lineWidth = DIVIDER_LINE_WIDTH;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(DIVIDER_X, DIVIDER_Y);
	ctx.lineTo(DIVIDER_X + DIVIDER_WIDTH, DIVIDER_Y);
	ctx.stroke();

	if (isBlank) {
		return;
	}

	let cursorY = BODY_TEXT_Y;
	const text = getLocalizedText(record, ['Text']);
	if (text.trim()) {
		ctx.font = BODY_TEXT_FONT;
		cursorY = drawBodyText(ctx, text, { startY: cursorY });
	}

	const funny = record['Funny text'];
	if (funny && funny.trim()) {
		cursorY += FUNNY_TEXT_GAP;
		ctx.font = FUNNY_TEXT_FONT;
		ctx.fillStyle = FUNNY_TEXT_COLOR;
		drawTextBlock(ctx, funny, {
			x: BODY_TEXT_X,
			y: cursorY,
			maxWidth: TICKET_CARD_SIZE - BODY_TEXT_X - BODY_TEXT_RIGHT_PADDING,
			lineHeight: TICKET_TEXT_LINE_HEIGHT,
			blankLineHeight: TICKET_TEXT_LINE_HEIGHT
		});
	}
}

function paintWorkSlots(ctx, record, { isBlank = false } = {}) {
	if (isBlank) {
		return;
	}

	const slotCount = normalizeSlotCount(record['Counter slots']);
	for (let index = 0; index < slotCount; index += 1) {
		const x = SLOT_X_POSITIONS[index] ?? SLOT_START_X;
		ctx.save();
		ctx.strokeStyle = SLOT_BORDER_COLOR;
		ctx.lineWidth = SLOT_BORDER_WIDTH;
		drawRoundedRectPath(ctx, x, SLOT_Y, SLOT_SIZE, SLOT_SIZE, SLOT_RADIUS);
		ctx.stroke();
		ctx.restore();
	}
}

function drawBodyText(ctx, raw, { startY }) {
	const normalized = String(raw ?? '')
		.replace(/\r/g, '')
		.replace(/\t/g, '    ');
	if (!normalized.trim()) {
		return startY;
	}

	const lines = normalized.split('\n');
	const regularWidth = TICKET_CARD_SIZE - BODY_TEXT_X - BODY_TEXT_RIGHT_PADDING;
	const iconWidth = TICKET_CARD_SIZE - BODY_TEXT_WITH_ICON_X - BODY_TEXT_RIGHT_PADDING;
	let cursorY = startY;

	ctx.textBaseline = 'top';
	ctx.textAlign = 'left';
	ctx.fillStyle = BODY_TEXT_COLOR;

	for (const line of lines) {
		if (!line.trim()) {
			cursorY += TICKET_TEXT_LINE_HEIGHT;
			continue;
		}

		const directiveInfo = extractDirectiveInfo(line);
		if (!directiveInfo) {
			cursorY = drawWrappedLine(ctx, line, BODY_TEXT_X, cursorY, regularWidth, TICKET_TEXT_LINE_HEIGHT);
			continue;
		}

		const paragraphText = directiveInfo.text || '';
		const paragraphHeight = measureWrappedLineHeight(ctx, paragraphText, iconWidth, TICKET_TEXT_LINE_HEIGHT);
		drawDirectiveIcon(ctx, directiveInfo, DIRECTIVE_ICON_X, cursorY + paragraphHeight / 2);
		cursorY = drawWrappedLine(ctx, paragraphText, BODY_TEXT_WITH_ICON_X, cursorY, iconWidth, TICKET_TEXT_LINE_HEIGHT);
	}

	return cursorY;
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


function drawDirectiveIcon(ctx, style, x, centerY) {
	const radius = DIRECTIVE_ICON_SIZE / 2;
	const centerX = x + radius;
	ctx.save();
	ctx.fillStyle = style.color;
	ctx.beginPath();
	ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = DIRECTIVE_ICON_TEXT_COLOR;
	ctx.font = DIRECTIVE_ICON_TEXT_FONT;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(style.letter, centerX, centerY);
	ctx.restore();
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

function normalizeSlotCount(value) {
	const numeric = Number(value);
	if (!Number.isFinite(numeric) || numeric < 0) {
		return 0;
	}
	return Math.min(MAX_SLOT_COUNT, Math.floor(numeric));
}

function resolveCategoryStyle(record = {}) {
	const category = String(record.Category || '').trim().toUpperCase();
	return CATEGORY_STYLES[category] || DEFAULT_CATEGORY_STYLE;
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
