#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');
require('./utils/fontRegistry'); // Register fonts
const {
	ROLE_CARD_HEIGHT,
	ROLE_CARD_WIDTH,
	RECT_CARD_SCALE
} = require('./utils/constants');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { resolveOutputPath } = require('./utils/runtimeConfig');
const { getLocalizedText } = require('./utils/textHelpers');

const s = (value) => Math.round(value * RECT_CARD_SCALE);
const ROLE_BACKGROUND_COLOR = '#ffffff';
const ROLE_WATERMARK_TEXT = 'ROLE';
const ROLE_WATERMARK_COLOR = '#c8fffc';
const ROLE_WATERMARK_FONT = '900 304px "Inter", sans-serif';
const ROLE_WATERMARK_X = -14;
const ROLE_WATERMARK_Y = -84;
const ROLE_TITLE_COLOR = '#000000';
const ROLE_TITLE_FONT = '700 86px "Inter", sans-serif';
const ROLE_TITLE_Y = 153;
const ROLE_BODY_X = 68;
const ROLE_BODY_Y = 387;
const ROLE_BODY_COLOR = '#000000';
const ROLE_BODY_FONT = '400 48px "Inter", sans-serif';
const ROLE_BODY_LINE_HEIGHT = Math.round(48 * 1.2);
const ROLE_FOOTER_Y = 861;
const ROLE_FOOTER_COLOR = '#e6fffe';
const ROLE_FOOTER_TOP_INSET_HEIGHT = 17;
const ROLE_FOOTER_TOP_INSET_COLOR = '#cbfbf9';
const ROLE_FOOTER_TEXT = 'B2B AI SaaS';
const ROLE_FOOTER_TEXT_Y = 896;
const ROLE_FOOTER_TEXT_COLOR = '#4d4d4d';
const ROLE_FOOTER_TEXT_FONT = '700 64px "Inter", sans-serif';

async function main() {
	const csvPath = path.resolve(__dirname, '../data/roles.csv');
	const outputDir = resolveOutputPath('roles');
	const miscDir = resolveOutputPath('misc');

	await Promise.all([
		fs.mkdir(outputDir, { recursive: true }),
		fs.mkdir(miscDir, { recursive: true })
	]);

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
			const safeTitle = sanitizeFileName(title) || 'Role';
			const facePath = path.join(outputDir, `${safeTitle}.png`);
			await drawRoleCard(facePath, record);
		})
	);

	const sharedBackPath = path.join(miscDir, 'role-back.png');
	await drawRoleBack(sharedBackPath, {});

	console.log(
		`Generated ${validRoles.length} role card faces in ${outputDir} and shared back at ${sharedBackPath}`
	);
}

async function drawRoleCard(filePath, record, options = {}) {
	const canvas = createCanvas(ROLE_CARD_WIDTH, ROLE_CARD_HEIGHT);
	const ctx = canvas.getContext('2d');
	paintBackground(ctx);
	paintRoleContent(ctx, record, { isBlank: options.blank === true || record.__blank === true });
	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

async function drawRoleBack(filePath, record, options = {}) {
	const canvas = createCanvas(ROLE_CARD_WIDTH, ROLE_CARD_HEIGHT);
	const ctx = canvas.getContext('2d');
	paintBackground(ctx);
	paintRoleBack(ctx, { isBlank: options.blank === true || record.__blank === true });
	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

function paintBackground(ctx) {
	ctx.fillStyle = ROLE_BACKGROUND_COLOR;
	ctx.fillRect(0, 0, ROLE_CARD_WIDTH, ROLE_CARD_HEIGHT);
}

function paintRoleBack(ctx, { isBlank = false } = {}) {
	if (isBlank) {
		return;
	}

	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = ROLE_TITLE_COLOR;
	ctx.font = `600 ${s(20)}px "Inter", sans-serif`;
	ctx.fillText('ROLE CARD', ROLE_CARD_WIDTH / 2, ROLE_CARD_HEIGHT / 2);
}

function paintRoleContent(ctx, record, { isBlank = false } = {}) {
	const title = (record.Title || 'Role').trim();
	const contentWidth = ROLE_CARD_WIDTH - ROLE_BODY_X * 2;

	if (isBlank) {
		return;
	}

	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.fillStyle = ROLE_WATERMARK_COLOR;
	ctx.font = ROLE_WATERMARK_FONT;
	ctx.fillText(ROLE_WATERMARK_TEXT, ROLE_WATERMARK_X, ROLE_WATERMARK_Y);

	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';
	ctx.fillStyle = ROLE_TITLE_COLOR;
	ctx.font = ROLE_TITLE_FONT;
	ctx.fillText(title, ROLE_CARD_WIDTH / 2, ROLE_TITLE_Y);

	const text = getLocalizedText(record, ['Text']);
	if (text) {
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.fillStyle = ROLE_BODY_COLOR;
		ctx.font = ROLE_BODY_FONT;
		drawTextBlock(ctx, text, {
			x: ROLE_BODY_X,
			y: ROLE_BODY_Y,
			maxWidth: contentWidth,
			lineHeight: ROLE_BODY_LINE_HEIGHT,
			blankLineHeight: ROLE_BODY_LINE_HEIGHT
		});
	}

	paintFooterBlock(ctx);
}

function paintFooterBlock(ctx) {
	const footerHeight = ROLE_CARD_HEIGHT - ROLE_FOOTER_Y;
	ctx.fillStyle = ROLE_FOOTER_COLOR;
	ctx.fillRect(0, ROLE_FOOTER_Y, ROLE_CARD_WIDTH, footerHeight);

	ctx.fillStyle = ROLE_FOOTER_TOP_INSET_COLOR;
	ctx.fillRect(0, ROLE_FOOTER_Y, ROLE_CARD_WIDTH, ROLE_FOOTER_TOP_INSET_HEIGHT);

	ctx.fillStyle = ROLE_FOOTER_TEXT_COLOR;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';
	ctx.font = ROLE_FOOTER_TEXT_FONT;
	ctx.fillText(ROLE_FOOTER_TEXT, ROLE_CARD_WIDTH / 2, ROLE_FOOTER_TEXT_Y);
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
	drawRoleCard,
	drawRoleBack
};
