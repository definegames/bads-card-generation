#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');
require('./utils/fontRegistry'); // Register fonts
const {
	CARD_SIZE,
	EDGE_THICKNESS,
	CONTENT_PADDING,
	LARGE_CARD_SCALE,
	BODY_TEXT_COLOR,
	MILESTONE_BACK_FILE_NAME
} = require('./utils/constants');
const { paintEdgesAndDividers } = require('./utils/edgePainter');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { resolveOutputPath } = require('./utils/runtimeConfig');
const { getLocalizedText } = require('./utils/textHelpers');

const MILESTONE_FACE_BACKGROUND = '#dff6c2';
const SCORE_PANEL_COLOR = '#243c2c';
const SCORE_PANEL_LABEL_COLOR = '#f0e6d8';
const s = (value) => Math.round(value * LARGE_CARD_SCALE);
const INFO_BADGE_RADIUS = s(70);
const INFO_BADGE_GAP = s(28);
const INFO_BADGE_VALUE_COLOR = '#ffffff';
const INFO_BADGE_VALUE_ALPHA = 0.35;
const DEADLINE_BADGE_COLOR = '#5b2324';
const MILESTONE_BACK_BASE = '#f7efe3';
const MILESTONE_BACK_GLOW = '#fefaf2';

const SCORE_STACK_HEADER_HEIGHT = s(26);
const SCORE_STACK_HEADER_GAP = s(10);
const SCORE_STACK_ITEM_HEIGHT = s(44);
const SCORE_STACK_ITEM_GAP = s(10);
const SCORE_STACK_ITEM_RADIUS = s(14);
const SCORE_STACK_ITEM_PADDING_X = s(14);

const SCORE_STACK_ITEM_COLORS = ['#4ea865', '#347b4f', SCORE_PANEL_COLOR];

async function main() {
	const csvPath = path.resolve(__dirname, '../data/milestones.csv');
	const outputDir = resolveOutputPath('milestones');
	const miscDir = resolveOutputPath('misc');

	await Promise.all([
		fs.mkdir(outputDir, { recursive: true }),
		fs.mkdir(miscDir, { recursive: true })
	]);

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
		})
	);

	const sharedBackPath = path.join(miscDir, MILESTONE_BACK_FILE_NAME);
	await drawMilestoneBack(sharedBackPath, {});

	console.log(
		`Generated ${filteredMilestones.length} milestone card faces in ${outputDir} and shared back at ${sharedBackPath}`
	);
}

function sanitizeFileName(value) {
	return value.replace(/[^a-z0-9._-]+/gi, '_');
}

function paintBackground(ctx) {
	ctx.fillStyle = MILESTONE_FACE_BACKGROUND;
	ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

}


async function drawMilestoneFront(filePath, record, options = {}) {
	const canvas = createCanvas(CARD_SIZE, CARD_SIZE);
	const ctx = canvas.getContext('2d');
	const isBlank = options.blank === true || record.__blank === true;
	paintBackground(ctx);
	paintEdgesAndDividers(ctx, record);
	paintCopy(ctx, record, { isBlank });
	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

async function drawMilestoneBack(filePath, record = {}, options = {}) {
	const canvas = createCanvas(CARD_SIZE, CARD_SIZE);
	const ctx = canvas.getContext('2d');
	const isBlank = options.blank === true || record.__blank === true;
	paintBack(ctx, { isBlank });
	await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

function paintCopy(ctx, record, { isBlank = false } = {}) {
	const safeZoneLeft = EDGE_THICKNESS + CONTENT_PADDING;
	const safeZoneRight = CARD_SIZE - EDGE_THICKNESS - CONTENT_PADDING;
	const contentWidth = safeZoneRight - safeZoneLeft;
	const safeZoneBottom = CARD_SIZE - EDGE_THICKNESS - CONTENT_PADDING;

// Title (smaller font)
	if (!isBlank) {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillStyle = BODY_TEXT_COLOR;
		ctx.font = `700 ${s(28)}px "Noto Sans", "Noto Color Emoji", "Montserrat", "Noto Color Emoji", sans-serif`;
		ctx.fillText((record.Title || '').trim(), CARD_SIZE / 2, EDGE_THICKNESS + s(16));
	}

	// Divider line
	ctx.strokeStyle = '#d9cbbd';
	ctx.lineWidth = s(2);
	ctx.beginPath();
	ctx.moveTo(safeZoneLeft, EDGE_THICKNESS + s(56));
	ctx.lineTo(safeZoneRight, EDGE_THICKNESS + s(56));
	ctx.stroke();

	if (isBlank) {
		return;
	}

	// Body copy (smaller font)
	ctx.textAlign = 'left';
	const bodyFont = `500 ${s(18)}px "Noto Sans", "Noto Color Emoji", "Montserrat", "Noto Color Emoji", sans-serif`;
	ctx.font = bodyFont;

	let cursorY = EDGE_THICKNESS + s(90);
	const minimumScoreValues = formatMinimumScoreValues(record['Minimum Score']);
	const deadlineValue = formatDeadlineValue(record.Deadline);

	const bodyLineHeight = s(24);
	const blankLineHeight = s(22);
	const bodyCopy = getLocalizedText(record, ['Text']);
	cursorY = drawTextBlock(ctx, bodyCopy, {
		x: safeZoneLeft,
		y: cursorY,
		maxWidth: contentWidth,
		lineHeight: bodyLineHeight,
		blankLineHeight
	});

	const funny = record['Funny text'];
	if (funny && funny.trim()) {
		cursorY += s(18);
		ctx.font = `italic 500 ${s(18)}px "Noto Sans", "Noto Color Emoji", "Montserrat", "Noto Color Emoji", sans-serif`;
		cursorY = drawTextBlock(ctx, funny, {
			x: safeZoneLeft,
			y: cursorY,
			maxWidth: contentWidth,
			lineHeight: s(22),
			blankLineHeight: s(20)
		});
	}

	drawInfoBadges(ctx, {
		scoreValues: minimumScoreValues,
		deadlineValue,
		safeZoneBottom
	});
}

function drawInfoBadges(ctx, { scoreValues, deadlineValue, safeZoneBottom }) {
	const hasScore = Array.isArray(scoreValues) && scoreValues.some((value) => String(value ?? '').trim());
	const hasDeadline = Boolean(String(deadlineValue ?? '').trim());
	if (!hasScore && !hasDeadline) {
		return;
	}

	const gap = INFO_BADGE_GAP;
	const radius = INFO_BADGE_RADIUS;
	const diameter = radius * 2;

	const scoreWidth = hasScore ? diameter : 0;
	const scoreHeight = hasScore
		? SCORE_STACK_HEADER_HEIGHT + SCORE_STACK_HEADER_GAP + SCORE_STACK_ITEM_HEIGHT * 3 + SCORE_STACK_ITEM_GAP * 2
		: 0;
	const deadlineWidth = hasDeadline ? diameter : 0;
	const deadlineHeight = hasDeadline ? SCORE_STACK_HEADER_HEIGHT + SCORE_STACK_HEADER_GAP + diameter : 0;

	const itemsCount = Number(hasScore) + Number(hasDeadline);
	const totalWidth = scoreWidth + deadlineWidth + Math.max(itemsCount - 1, 0) * gap;

	const bottomMargin = s(16);
	const sharedTopY = safeZoneBottom - Math.max(scoreHeight, deadlineHeight) - bottomMargin;
	const scoreTopY = sharedTopY;
	const deadlineHeaderY = sharedTopY;
	const scoreStackTopY = sharedTopY + SCORE_STACK_HEADER_HEIGHT + SCORE_STACK_HEADER_GAP;
	const scoreStackHeight = SCORE_STACK_ITEM_HEIGHT * 3 + SCORE_STACK_ITEM_GAP * 2;
	const alignedDeadlineCenterY = scoreStackTopY + scoreStackHeight / 2;
	const deadlineCenterY = hasScore ? alignedDeadlineCenterY : sharedTopY + SCORE_STACK_HEADER_HEIGHT + SCORE_STACK_HEADER_GAP + radius;

	let cursorX = CARD_SIZE / 2 - totalWidth / 2;
	if (hasScore) {
		drawScoreFrame(ctx, {
			x: cursorX,
			y: scoreTopY,
			width: scoreWidth,
			height: scoreHeight,
			radius: SCORE_STACK_ITEM_RADIUS,
			values: scoreValues
		});
		cursorX += scoreWidth + gap;
	}

	if (hasDeadline) {
		ctx.save();
		ctx.fillStyle = SCORE_PANEL_COLOR;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.font = `900 ${s(20)}px "Noto Sans", "Noto Color Emoji", "Montserrat", sans-serif`;
		ctx.fillText('DEADLINE', cursorX + radius, deadlineHeaderY);
		ctx.restore();

		drawDeadlineBadge(ctx, {
			value: deadlineValue,
			fill: DEADLINE_BADGE_COLOR,
			centerX: cursorX + radius,
			centerY: deadlineCenterY,
			radius
		});
	}
}

function drawDeadlineBadge(ctx, { value, centerX, centerY, radius, fill = DEADLINE_BADGE_COLOR }) {
	ctx.save();
	ctx.beginPath();
	ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
	ctx.closePath();
	ctx.fillStyle = fill;
	ctx.fill();

	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = SCORE_PANEL_LABEL_COLOR;
	const valueFontSize = fitBadgeValueFont(ctx, value, radius);
	ctx.font = `900 ${valueFontSize}px "Montserrat", "Noto Color Emoji", sans-serif`;
	ctx.fillText(String(value), centerX, centerY);
	ctx.restore();
}

function drawScoreFrame(ctx, { x, y, width, values }) {
	const safeValues = normalizeMinimumScoreValues(values);
	const hasAny = safeValues.some((value) => String(value ?? '').trim());
	if (!hasAny) {
		return;
	}

	ctx.save();
	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';
	ctx.fillStyle = SCORE_PANEL_COLOR;
	ctx.font = `900 ${s(20)}px "Noto Sans", "Noto Color Emoji", "Montserrat", sans-serif`;
	ctx.fillText('SCORE', x + width / 2, y);

	let cursorY = y + SCORE_STACK_HEADER_HEIGHT + SCORE_STACK_HEADER_GAP;
	const labels = ['1st', '2nd', '3rd'];
	const labelColor = '#b7b0a6';
	const valueColor = SCORE_PANEL_LABEL_COLOR;
	const labelFont = `800 ${s(18)}px "Noto Sans", "Noto Color Emoji", "Montserrat", sans-serif`;
	const valueFont = `900 ${s(20)}px "Montserrat", "Noto Color Emoji", sans-serif`;
	ctx.font = labelFont;
	const labelWidthMax = Math.max(
		...labels.map((label) => ctx.measureText(`${label}:`).width)
	);
	const valueStartX = x + SCORE_STACK_ITEM_PADDING_X + labelWidthMax + s(10);

	for (let i = 0; i < 3; i += 1) {
		const frameY = cursorY + i * (SCORE_STACK_ITEM_HEIGHT + SCORE_STACK_ITEM_GAP);
		const fill = SCORE_STACK_ITEM_COLORS[i] ?? SCORE_PANEL_COLOR;

		ctx.save();
		ctx.fillStyle = fill;
		roundRect(ctx, x, frameY, width, SCORE_STACK_ITEM_HEIGHT, SCORE_STACK_ITEM_RADIUS);
		ctx.fill();

		ctx.strokeStyle = `${SCORE_PANEL_LABEL_COLOR}55`;
		ctx.lineWidth = s(3);
		ctx.stroke();

		const rawValue = String(safeValues[i] ?? '').trim();
		const displayValue = rawValue ? rawValue : '—';
		const centerY = frameY + SCORE_STACK_ITEM_HEIGHT / 2;

		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';

		ctx.globalAlpha = 0.9;
		ctx.fillStyle = labelColor;
		ctx.font = labelFont;
		ctx.fillText(`${labels[i]}:`, x + SCORE_STACK_ITEM_PADDING_X, centerY);

		ctx.globalAlpha = rawValue ? 1 : 0.65;
		ctx.fillStyle = valueColor;
		ctx.font = valueFont;
		ctx.fillText(displayValue, valueStartX, centerY);
		ctx.restore();
	}

	ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
	const r = Math.max(0, Math.min(radius, width / 2, height / 2));
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + width, y, x + width, y + height, r);
	ctx.arcTo(x + width, y + height, x, y + height, r);
	ctx.arcTo(x, y + height, x, y, r);
	ctx.arcTo(x, y, x + width, y, r);
	ctx.closePath();
}

function drawInfoBadge(ctx, { label, value, centerX, centerY, radius, fill = SCORE_PANEL_COLOR }) {
	ctx.save();
	ctx.beginPath();
	ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
	ctx.closePath();
	ctx.fillStyle = fill;
	ctx.fill();

	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = SCORE_PANEL_LABEL_COLOR;
	ctx.font = `700 ${s(20)}px "Noto Sans", "Noto Color Emoji", "Montserrat", "Noto Color Emoji", sans-serif`;
	ctx.fillText(label, centerX, centerY);

	ctx.save();
	ctx.fillStyle = INFO_BADGE_VALUE_COLOR;
	ctx.globalAlpha = INFO_BADGE_VALUE_ALPHA;
	const valueFontSize = fitBadgeValueFont(ctx, value, radius);
	ctx.font = `900 ${valueFontSize}px "Montserrat", "Noto Color Emoji", sans-serif`;
	ctx.fillText(value, centerX, centerY);
	ctx.restore();
	ctx.restore();
}

function fitBadgeValueFont(ctx, value, radius) {
	const maxWidth = radius * 1.6;
	let size = Math.min(radius * 1.5, s(120));
	const minSize = s(28);
	while (size >= minSize) {
		ctx.font = `900 ${size}px "Montserrat", "Noto Color Emoji", sans-serif`;
		if (ctx.measureText(String(value)).width <= maxWidth) {
			return size;
		}
		size -= s(4);
	}
	return minSize;
}

function normalizeMinimumScoreValues(values) {
	if (!Array.isArray(values)) {
		return ['', '', ''];
	}
	const trimmed = values.map((value) => String(value ?? '').trim()).filter(Boolean);
	return [trimmed[0] ?? '', trimmed[1] ?? '', trimmed[2] ?? ''];
}

function formatMinimumScoreValues(value) {
	const raw = String(value ?? '').trim();
	if (!raw) {
		return [];
	}
	const parts = raw
		.split(',')
		.map((piece) => String(piece ?? '').trim())
		.filter(Boolean);
	return parts;
}

function formatDeadlineValue(value) {
	const raw = String(value ?? '').trim();
	if (!raw) {
		return '';
	}
	const numeric = Number(raw);
	if (Number.isFinite(numeric)) {
		return `${numeric}`;
	}
	return raw;
}

function paintBack(ctx, { isBlank = false } = {}) {
	ctx.fillStyle = MILESTONE_BACK_BASE;
	ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

	const gradient = ctx.createLinearGradient(EDGE_THICKNESS, EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
	gradient.addColorStop(0, MILESTONE_BACK_GLOW);
	gradient.addColorStop(1, '#ecdcc4');
	ctx.fillStyle = gradient;
	ctx.fillRect(EDGE_THICKNESS, EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS * 2, CARD_SIZE - EDGE_THICKNESS * 2);

	ctx.strokeStyle = `${SCORE_PANEL_COLOR}33`;
	ctx.lineWidth = s(6);
	ctx.strokeRect(
		EDGE_THICKNESS + s(12),
		EDGE_THICKNESS + s(12),
		CARD_SIZE - (EDGE_THICKNESS + s(12)) * 2,
		CARD_SIZE - (EDGE_THICKNESS + s(12)) * 2
	);

	ctx.fillStyle = `${SCORE_PANEL_COLOR}10`;
	ctx.beginPath();
	ctx.arc(CARD_SIZE / 2, CARD_SIZE / 2, s(140), 0, Math.PI * 2);
	ctx.fill();

	if (isBlank) {
		return;
	}

	ctx.fillStyle = SCORE_PANEL_COLOR;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = `800 ${s(48)}px "Montserrat", "Noto Color Emoji", sans-serif`;
	ctx.fillText('MILESTONE', CARD_SIZE / 2, CARD_SIZE / 2);
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
