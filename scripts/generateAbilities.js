#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');
require('./utils/fontRegistry'); // Register fonts
const {
	CARD_SIZE,
	LARGE_CARD_TITLE_LEFT,
	LARGE_CARD_TITLE_TOP,
	LARGE_CARD_TITLE_FONT_SIZE,
	LARGE_CARD_TITLE_FONT_WEIGHT,
	LARGE_CARD_SCALE,
	BODY_TEXT_COLOR
} = require('./utils/constants');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { resolveOutputPath } = require('./utils/runtimeConfig');
const { getLocalizedText } = require('./utils/textHelpers');
const s = (value) => Math.round(value * LARGE_CARD_SCALE);
const ABILITY_TITLE_X = LARGE_CARD_TITLE_LEFT;
const ABILITY_TITLE_Y = LARGE_CARD_TITLE_TOP;
const ABILITY_DIVIDER_X = 119;
const ABILITY_DIVIDER_Y = 275;
const ABILITY_TEXT_X = 119;
const ABILITY_TEXT_Y = 314;
const ABILITY_TEXT_FONT_SIZE = 36;
const ABILITY_TEXT_LINE_HEIGHT = Math.round(ABILITY_TEXT_FONT_SIZE * 1.35);
const ABILITY_PILL_X = 853;
const ABILITY_PILL_Y = 32;
const ABILITY_PILL_WIDTH = 120;
const ABILITY_PILL_HEIGHT = 100;
const ABILITY_PILL_RADIUS = 25;

async function main() {
	const csvPath = path.resolve(__dirname, '../data/abilities.csv');
	const outputDir = resolveOutputPath('abilities');

	await fs.mkdir(outputDir, { recursive: true });

	const csvRaw = await fs.readFile(csvPath, 'utf8');
	const abilities = parse(csvRaw, {
		columns: true,
		skip_empty_lines: true,
		relax_quotes: true
	}).filter((record) => !shouldIgnoreRecord(record));

	const jobs = [];
	for (const ability of abilities) {
		const copies = normalizeCopies(ability.Copies);
		const slug = sanitizeFileName(ability.ID || ability.Title || 'ability');
		for (let index = 0; index < copies; index++) {
			const suffix = copies > 1 ? `-copy${index + 1}` : '';
			const targetPath = path.join(outputDir, `${slug}${suffix}.png`);
			jobs.push(drawAbilityCard(targetPath, ability));
		}
	}

	await Promise.all(jobs);

	console.log(`Generated ${jobs.length} ability cards in ${outputDir}`);
}

async function drawAbilityCard(filePath, record, options = {}) {
	const isBlank = options.blank === true || record.__blank === true;
	const canvas = createCanvas(CARD_SIZE, CARD_SIZE);
	const ctx = canvas.getContext('2d');

	paintBackground(ctx);
	paintAbilityContent(ctx, record, { isBlank });

	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

function paintBackground(ctx) {
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);
}

function paintAbilityContent(ctx, record, { isBlank = false } = {}) {
	const safeWidth = CARD_SIZE - ABILITY_TEXT_X * 2;
	paintHeaderRow(ctx, record, { isBlank });

	if (!isBlank) {
		const title = (record.Title || 'Untitled Ability').trim();
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.fillStyle = BODY_TEXT_COLOR;
		ctx.font = `${LARGE_CARD_TITLE_FONT_WEIGHT} ${LARGE_CARD_TITLE_FONT_SIZE}px "Inter", sans-serif`;
		ctx.fillText(title, ABILITY_TITLE_X, ABILITY_TITLE_Y);
	}

	ctx.strokeStyle = '#a3a3a3';
	ctx.lineWidth = s(1);
	ctx.beginPath();
	ctx.moveTo(ABILITY_DIVIDER_X, ABILITY_DIVIDER_Y);
	ctx.lineTo(ABILITY_DIVIDER_X + 513, ABILITY_DIVIDER_Y);
	ctx.stroke();

	if (isBlank) {
		return;
	}
	let cursorY = ABILITY_TEXT_Y;
	ctx.textAlign = 'left';
	ctx.fillStyle = BODY_TEXT_COLOR;
	ctx.font = `400 ${ABILITY_TEXT_FONT_SIZE}px "Inter", sans-serif`;
	const description = getLocalizedText(record, ['Text']);
	cursorY = drawTextBlock(ctx, description, {
		x: ABILITY_TEXT_X,
		y: cursorY,
		maxWidth: safeWidth,
		lineHeight: ABILITY_TEXT_LINE_HEIGHT,
		blankLineHeight: ABILITY_TEXT_LINE_HEIGHT
	});

	const funny = record['Funny text'];
	if (funny && funny.trim()) {
		cursorY += s(20);
		ctx.font = `italic 400 ${ABILITY_TEXT_FONT_SIZE}px "Inter", sans-serif`;
		ctx.fillStyle = '#5c4d40';
		drawTextBlock(ctx, funny, {
			x: ABILITY_TEXT_X,
			y: cursorY,
			maxWidth: safeWidth,
			lineHeight: ABILITY_TEXT_LINE_HEIGHT,
			blankLineHeight: ABILITY_TEXT_LINE_HEIGHT
		});
	}
}


function normalizePointsValue(record = {}) {
	const raw = record.Points ?? '';
	const trimmed = String(raw).trim();
	if (!trimmed) {
		return '';
	}
	const numeric = Number(trimmed);
	if (Number.isFinite(numeric)) {
		return String(Math.max(0, Math.floor(numeric)));
	}
	return trimmed;
}

function paintHeaderRow(ctx, record, { isBlank = false } = {}) {
	const pointsValue = isBlank ? '' : normalizePointsValue(record);
	return drawScorePill(ctx, pointsValue, { isBlank });
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

function drawScorePill(ctx, scoreValue, { isBlank = false } = {}) {
	const pillX = ABILITY_PILL_X;
	const pillY = ABILITY_PILL_Y;

	ctx.fillStyle = '#efefef';
	ctx.strokeStyle = '#c5c5c5';
	ctx.lineWidth = 2;
	drawRoundedRect(ctx, pillX, pillY, ABILITY_PILL_WIDTH, ABILITY_PILL_HEIGHT, ABILITY_PILL_RADIUS, true);

	if (!isBlank && String(scoreValue || '').trim()) {
		ctx.fillStyle = '#b3b3b3';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = `700 72px "Inter", sans-serif`;
		ctx.fillText(scoreValue, pillX + ABILITY_PILL_WIDTH / 2, pillY + ABILITY_PILL_HEIGHT / 2);
	}

	return pillY + ABILITY_PILL_HEIGHT;
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
		const width = ctx.measureText(testLine).width;
		if (width > maxWidth && line) {
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
		console.error('Failed to generate ability cards:', error);
		process.exitCode = 1;
	});
}

module.exports = {
	drawAbilityCard
};
