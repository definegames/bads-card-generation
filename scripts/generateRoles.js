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
	ROLE_CARD_HEIGHT,
	ROLE_CARD_WIDTH,
	RECT_CARD_SCALE,
	ROLE_CARD_BACKGROUND,
	ROLE_ACCENT_COLOR
} = require('./utils/constants');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { resolveOutputPath } = require('./utils/runtimeConfig');
const { getLocalizedText } = require('./utils/textHelpers');

const FOUNDER_TITLE = 'The Founder';
const s = (value) => Math.round(value * RECT_CARD_SCALE);

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

	if (!validRoles.some(isFounderRecord)) {
		throw new Error('The Founder role is required in roles.csv but was not found.');
	}

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
	ctx.fillStyle = ROLE_CARD_BACKGROUND;
	ctx.fillRect(0, 0, ROLE_CARD_WIDTH, ROLE_CARD_HEIGHT);

	ctx.strokeStyle = '#d4cdc3';
	ctx.lineWidth = s(4);
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

function paintRoleBack(ctx, { isBlank = false } = {}) {
	const centerX = ROLE_CARD_WIDTH / 2;
	const centerY = ROLE_CARD_HEIGHT / 2;

	const glow = ctx.createRadialGradient(centerX, centerY, s(40), centerX, centerY, ROLE_CARD_HEIGHT / 2);
	glow.addColorStop(0, `${ROLE_ACCENT_COLOR}33`);
	glow.addColorStop(1, `${ROLE_ACCENT_COLOR}00`);
	ctx.fillStyle = glow;
	ctx.fillRect(EDGE_THICKNESS, EDGE_THICKNESS, ROLE_CARD_WIDTH - EDGE_THICKNESS * 2, ROLE_CARD_HEIGHT - EDGE_THICKNESS * 2);

	ctx.strokeStyle = `${ROLE_ACCENT_COLOR}66`;
	ctx.lineWidth = s(6);
	ctx.beginPath();
	ctx.arc(centerX, centerY, ROLE_CARD_WIDTH * 0.32, 0, Math.PI * 2);
	ctx.stroke();

	ctx.fillStyle = `${ROLE_ACCENT_COLOR}10`;
	ctx.beginPath();
	ctx.arc(centerX, centerY, ROLE_CARD_WIDTH * 0.28, 0, Math.PI * 2);
	ctx.fill();

	if (isBlank) {
		return;
	}

	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = BODY_TEXT_COLOR;
	ctx.font = `600 ${s(20)}px "Inter", sans-serif`;
	ctx.fillText('ROLE CARD', centerX, centerY);
}

function paintRoleContent(ctx, record, { isBlank = false } = {}) {
	const safeLeft = EDGE_THICKNESS + CONTENT_PADDING;
	const safeRight = ROLE_CARD_WIDTH - EDGE_THICKNESS - CONTENT_PADDING;
	const safeTop = EDGE_THICKNESS + CONTENT_PADDING;
	const contentWidth = safeRight - safeLeft;

	const title = (record.Title || 'Role').trim();
	const isFounder = isFounderRecord(record);

	let titleY = safeTop;
	let titleFontSize = 0;
	if (!isBlank) {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillStyle = BODY_TEXT_COLOR;
		const fittedFont = fitTitleFont(ctx, title, contentWidth);
		titleFontSize = fittedFont.size;
		ctx.font = fittedFont.font;
		ctx.fillText(title, ROLE_CARD_WIDTH / 2, titleY);
	}

	const dividerY = titleY + (titleFontSize || s(44)) + s(18);
	ctx.strokeStyle = '#d9cbbd';
	ctx.lineWidth = s(2);
	ctx.beginPath();
	ctx.moveTo(safeLeft, dividerY);
	ctx.lineTo(safeRight, dividerY);
	ctx.stroke();

	if (isBlank) {
		return;
	}

	let cursorY = dividerY + s(24);
	const text = getLocalizedText(record, ['Text']);
	if (text) {
		ctx.textAlign = 'left';
		ctx.font = `500 ${s(20)}px "Inter", sans-serif`;
		cursorY = drawTextBlock(ctx, text, {
			x: safeLeft,
			y: cursorY,
			maxWidth: contentWidth,
			lineHeight: s(28),
			blankLineHeight: s(24)
		});
	}

	const funny = (record['Funny text'] || '').trim();
	if (funny) {
		cursorY += s(24);
		ctx.font = `italic 500 ${s(18)}px "Inter", sans-serif`;
		ctx.fillStyle = '#5c4d40';
		cursorY = drawTextBlock(ctx, funny, {
			x: safeLeft,
			y: cursorY,
			maxWidth: contentWidth,
			lineHeight: s(24),
			blankLineHeight: s(20)
		});
	}

	if (isFounder && !isBlank) {
		cursorY += s(40);
		const starDefaultY = ROLE_CARD_HEIGHT - EDGE_THICKNESS - CONTENT_PADDING - s(40);
		const starMinY = cursorY + s(34);
		const starCenterY = Math.min(starDefaultY, Math.max(starMinY, safeTop + s(80)));
		drawFounderStar(ctx, ROLE_CARD_WIDTH / 2, starCenterY + s(40), { outerRadius: s(36), innerRadius: s(18) });
	}
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

function isFounderRecord(record = {}) {
	return (record.Title || '').trim().toLowerCase() === FOUNDER_TITLE.toLowerCase();
}

function drawFounderStar(ctx, x, y, { outerRadius = 60, innerRadius = 28 } = {}) {
	ctx.save();
	ctx.shadowColor = '#00000033';
	ctx.shadowBlur = s(12);
	drawStarPath(ctx, x, y, 5, outerRadius, innerRadius);
	const gradient = ctx.createLinearGradient(x, y - outerRadius, x, y + outerRadius);
	gradient.addColorStop(0, '#fff3b0');
	gradient.addColorStop(1, '#f6a328');
	ctx.fillStyle = gradient;
	ctx.fill();
	ctx.shadowBlur = 0;
	ctx.lineWidth = s(4);
	ctx.strokeStyle = '#d08a00';
	ctx.stroke();
	ctx.restore();
}

function drawStarPath(ctx, cx, cy, spikes, outerRadius, innerRadius) {
	let rotation = Math.PI / 2 * 3;
	const step = Math.PI / spikes;
	ctx.beginPath();
	ctx.moveTo(cx, cy - outerRadius);
	for (let i = 0; i < spikes; i++) {
		let x = cx + Math.cos(rotation) * outerRadius;
		let y = cy + Math.sin(rotation) * outerRadius;
		ctx.lineTo(x, y);
		rotation += step;

		x = cx + Math.cos(rotation) * innerRadius;
		y = cy + Math.sin(rotation) * innerRadius;
		ctx.lineTo(x, y);
		rotation += step;
	}
	ctx.lineTo(cx, cy - outerRadius);
	ctx.closePath();
}

function fitTitleFont(ctx, text, maxWidth) {
	const baseSize = s(42);
	const minSize = s(22);
	for (let size = baseSize; size >= minSize; size -= s(2)) {
		const font = `800 ${size}px "Inter", sans-serif`;
		ctx.font = font;
		if (ctx.measureText(text).width <= maxWidth || size === minSize) {
			return { font, size };
		}
	}
	const fallbackFont = `800 ${minSize}px "Inter", sans-serif`;
	return { font: fallbackFont, size: minSize };
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
