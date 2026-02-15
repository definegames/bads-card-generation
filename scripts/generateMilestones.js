#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
const { parse } = require('csv-parse/sync');
require('./utils/fontRegistry'); // Register fonts
const {
	CARD_SIZE,
	EDGE_THICKNESS,
	LARGE_CARD_SCALE,
	MILESTONE_BACK_FILE_NAME,
	TEXT_BLOCK_LINE_HEIGHT
} = require('./utils/constants');
const { paintEdgesAndDividers } = require('./utils/edgePainter');
const { shouldIgnoreRecord } = require('./utils/recordFilters');
const { resolveOutputPath } = require('./utils/runtimeConfig');

const MILESTONE_FACE_BACKGROUND = '#ffffff';
const MILESTONE_BODY_TEXT_COLOR = '#000000';
const SCORE_PANEL_COLOR = '#243c2c';
const s = (value) => Math.round(value * LARGE_CARD_SCALE);
const MILESTONE_TITLE_Y = 159;
const MILESTONE_TITLE_MAX_WIDTH = CARD_SIZE - 119 * 2;
const MILESTONE_FUNNY_TEXT_Y = 777;
const MILESTONE_FUNNY_TEXT_MAX_WIDTH = CARD_SIZE - 119 * 2;
const MILESTONE_TEXT_LINE_HEIGHT = s(TEXT_BLOCK_LINE_HEIGHT);

const SCORE_TITLE_TEXT = 'SCORE';
const SCORE_TITLE_X = 318;
const SCORE_TITLE_Y = 326;
const SCORE_TITLE_COLOR = '#000000';
const SCORE_TITLE_FONT = '900 40px "Inter", sans-serif';
const SCORE_ROW_X = 184;
const SCORE_ROW_WIDTH = 268;
const SCORE_ROW_HALF_WIDTH = 134;
const SCORE_ROW_HEIGHT = 81;
const SCORE_ROW_RADIUS = 5;
const SCORE_ROW_BORDER_WIDTH = 3;
const SCORE_ROW_BORDER_COLOR = '#526c4d';
const SCORE_ROW_LEFT_COLOR = '#d9d9d9';
const SCORE_ROW_LABEL_COLOR = '#8c8c8c';
const SCORE_ROW_LABEL_FONT = '300 48px "Inter", sans-serif';
const SCORE_ROW_VALUE_COLOR = '#000000';
const SCORE_ROW_VALUE_FONT = '900 48px "Inter", sans-serif';
const SCORE_ROW_TOPS = [390, 507, 624];
const SCORE_ROW_RIGHT_COLORS = ['#b4ee99', '#8dd36c', '#47cf08'];

const DEADLINE_TITLE_TEXT = 'DEADLINE';
const DEADLINE_TITLE_X = 678.5;
const DEADLINE_TITLE_Y = 326;
const DEADLINE_TITLE_COLOR = '#000000';
const DEADLINE_TITLE_FONT = '900 40px "Inter", sans-serif';
const DEADLINE_OUTER_X = 521;
const DEADLINE_OUTER_Y = 390;
const DEADLINE_OUTER_SIZE = 315;
const DEADLINE_OUTER_COLOR = '#9e7e7e';
const DEADLINE_INNER_X = 553;
const DEADLINE_INNER_Y = 422;
const DEADLINE_INNER_SIZE = 251;
const DEADLINE_VALUE_COLOR = '#aa1515';
const DEADLINE_VALUE_FONT = '900 140px "Inter", sans-serif';

const FUNNY_TEXT_COLOR = '#949494';
const FUNNY_TEXT_FONT = 'italic 400 36px "Inter", sans-serif';
const MILESTONE_BACK_BASE = '#f7efe3';
const MILESTONE_BACK_GLOW = '#fefaf2';

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
	if (!isBlank) {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillStyle = MILESTONE_BODY_TEXT_COLOR;
		ctx.font = '500 64px "Inter", sans-serif';
		ctx.fillText((record.Title || '').trim(), CARD_SIZE / 2, MILESTONE_TITLE_Y, MILESTONE_TITLE_MAX_WIDTH);

		drawScoreBlock(ctx, record);
		drawDeadlineBlock(ctx, record);

		const funny = (record['Funny text'] || '').trim();
		if (funny) {
			ctx.font = FUNNY_TEXT_FONT;
			ctx.fillStyle = FUNNY_TEXT_COLOR;
			drawTextBlock(ctx, funny, {
				x: CARD_SIZE / 2,
				y: MILESTONE_FUNNY_TEXT_Y,
				maxWidth: MILESTONE_FUNNY_TEXT_MAX_WIDTH,
				lineHeight: MILESTONE_TEXT_LINE_HEIGHT,
				blankLineHeight: MILESTONE_TEXT_LINE_HEIGHT,
				align: 'center'
			});
		}
	}
}

function drawScoreBlock(ctx, record) {
	const scoreValues = normalizeMinimumScoreValues(formatMinimumScoreValues(record['Minimum Score']));
	const labels = ['1st', '2nd', '3rd'];

	ctx.save();
	ctx.fillStyle = SCORE_TITLE_COLOR;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';
	ctx.font = SCORE_TITLE_FONT;
	ctx.fillText(SCORE_TITLE_TEXT, SCORE_TITLE_X, SCORE_TITLE_Y);
	ctx.restore();

	for (let index = 0; index < 3; index += 1) {
		drawScoreRow(ctx, {
			x: SCORE_ROW_X,
			y: SCORE_ROW_TOPS[index],
			label: labels[index],
			value: scoreValues[index] || '',
			rightColor: SCORE_ROW_RIGHT_COLORS[index]
		});
	}
}

function drawScoreRow(ctx, { x, y, label, value, rightColor }) {
	ctx.save();
	roundedRectPath(ctx, x, y, SCORE_ROW_WIDTH, SCORE_ROW_HEIGHT, SCORE_ROW_RADIUS);
	ctx.clip();
	ctx.fillStyle = SCORE_ROW_LEFT_COLOR;
	ctx.fillRect(x, y, SCORE_ROW_HALF_WIDTH, SCORE_ROW_HEIGHT);
	ctx.fillStyle = rightColor;
	ctx.fillRect(x + SCORE_ROW_HALF_WIDTH, y, SCORE_ROW_HALF_WIDTH, SCORE_ROW_HEIGHT);
	ctx.restore();

	ctx.save();
	ctx.strokeStyle = SCORE_ROW_BORDER_COLOR;
	ctx.lineWidth = SCORE_ROW_BORDER_WIDTH;
	roundedRectPath(ctx, x, y, SCORE_ROW_WIDTH, SCORE_ROW_HEIGHT, SCORE_ROW_RADIUS);
	ctx.stroke();
	ctx.restore();

	ctx.save();
	ctx.fillStyle = SCORE_ROW_LABEL_COLOR;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = SCORE_ROW_LABEL_FONT;
	ctx.fillText(label, x + SCORE_ROW_HALF_WIDTH / 2, y + SCORE_ROW_HEIGHT / 2);
	ctx.restore();

	ctx.save();
	ctx.fillStyle = SCORE_ROW_VALUE_COLOR;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = SCORE_ROW_VALUE_FONT;
	ctx.fillText(String(value || ''), x + SCORE_ROW_HALF_WIDTH + SCORE_ROW_HALF_WIDTH / 2, y + SCORE_ROW_HEIGHT / 2);
	ctx.restore();
}

function drawDeadlineBlock(ctx, record) {
	const deadlineValue = formatDeadlineValue(record.Deadline);

	ctx.save();
	ctx.fillStyle = DEADLINE_TITLE_COLOR;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';
	ctx.font = DEADLINE_TITLE_FONT;
	ctx.fillText(DEADLINE_TITLE_TEXT, DEADLINE_TITLE_X, DEADLINE_TITLE_Y);
	ctx.restore();

	ctx.save();
	ctx.fillStyle = DEADLINE_OUTER_COLOR;
	ctx.beginPath();
	ctx.arc(DEADLINE_OUTER_X + DEADLINE_OUTER_SIZE / 2, DEADLINE_OUTER_Y + DEADLINE_OUTER_SIZE / 2, DEADLINE_OUTER_SIZE / 2, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();

	ctx.save();
	ctx.fillStyle = MILESTONE_FACE_BACKGROUND;
	ctx.beginPath();
	ctx.arc(DEADLINE_INNER_X + DEADLINE_INNER_SIZE / 2, DEADLINE_INNER_Y + DEADLINE_INNER_SIZE / 2, DEADLINE_INNER_SIZE / 2, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();

	ctx.save();
	ctx.fillStyle = DEADLINE_VALUE_COLOR;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = DEADLINE_VALUE_FONT;
	ctx.fillText(String(deadlineValue || ''), DEADLINE_INNER_X + DEADLINE_INNER_SIZE / 2, DEADLINE_INNER_Y + DEADLINE_INNER_SIZE / 2);
	ctx.restore();
}

function roundedRectPath(ctx, x, y, width, height, radius) {
	const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
	ctx.beginPath();
	ctx.moveTo(x + safeRadius, y);
	ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
	ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
	ctx.arcTo(x, y + height, x, y, safeRadius);
	ctx.arcTo(x, y, x + width, y, safeRadius);
	ctx.closePath();
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
	ctx.font = `800 ${s(48)}px "Inter", sans-serif`;
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
