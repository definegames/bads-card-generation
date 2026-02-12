#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
require('./utils/fontRegistry'); // Register fonts
const {
	CARD_SIZE,
	EDGE_THICKNESS,
	CONTENT_PADDING,
	TICKET_CARD_SIZE,
	ROLE_CARD_WIDTH,
	ROLE_CARD_HEIGHT,
	LARGE_CARD_SCALE,
	SMALL_CARD_SCALE,
	RECT_CARD_SCALE,
	BODY_TEXT_COLOR,
	MISC_CARD_TYPES
} = require('./utils/constants');
const { resolveOutputPath } = require('./utils/runtimeConfig');

async function main() {
	const outputDir = resolveOutputPath('misc');
	await fs.mkdir(outputDir, { recursive: true });

	await Promise.all(
		MISC_CARD_TYPES.map(async (card) => {
			const width = card.width ?? CARD_SIZE;
			const height = card.height ?? CARD_SIZE;
			const canvas = createCanvas(width, height);
			const ctx = canvas.getContext('2d');
			if (card.key === 'player-deck') {
				paintRunwayBack(ctx, width, height);
			} else {
				paintCardBack(ctx, card, width, height);
			}
			const targetPath = path.join(outputDir, `${card.key}.png`);
			await fs.writeFile(targetPath, canvas.toBuffer('image/png'));
		})
	);

	console.log(`Generated ${MISC_CARD_TYPES.length} misc card backs in ${outputDir}`);
}

function paintCardBack(ctx, card, width, height) {
	const cardScale = resolveCardScale(width, height);
	const borderWidth = Math.max(1, Math.round(4 * cardScale));

	ctx.fillStyle = card.background;
	ctx.fillRect(0, 0, width, height);

	ctx.strokeStyle = card.borderColor || '#d4cdc3';
	ctx.lineWidth = borderWidth;
	ctx.strokeRect(EDGE_THICKNESS / 2, EDGE_THICKNESS / 2, width - EDGE_THICKNESS, height - EDGE_THICKNESS);

	const monogramSize = Math.floor(Math.min(width, height) * 0.55);
	const labelSize = Math.floor(Math.min(width, height) * 0.16);

	if (card.monogram !== false) {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = '#ffffff18';
		ctx.font = `900 ${monogramSize}px "Inter", "Noto Color Emoji", "Noto Sans", "Montserrat", sans-serif`;
		ctx.fillText(card.label.slice(0, 1), width / 2, height / 2);
	}

	ctx.fillStyle = card.textColor || BODY_TEXT_COLOR;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = `800 ${labelSize}px "Inter", "Noto Color Emoji", "Noto Sans", "Montserrat", sans-serif`;
	drawLabel(ctx, card, width, height, labelSize);

}

function drawLabel(ctx, card, width, height, labelSize) {
	const wrap = card.key === 'player-deck' || card.key === 'work-deck';
	const lines = wrap ? card.label.split(/\s+/).filter(Boolean) : [card.label];
	if (!lines.length) return;
	const lineHeight = labelSize * 1.2;
	const totalHeight = lineHeight * lines.length;
	let cursorY = height / 2 - totalHeight / 2 + lineHeight / 2;
	lines.forEach((line) => {
		ctx.fillText(line, width / 2, cursorY);
		cursorY += lineHeight;
	});
}

function paintRunwayBack(ctx, width, height) {
	const cardScale = resolveCardScale(width, height);
	const borderWidth = Math.max(1, Math.round(4 * cardScale));

	// Minty green background.
	ctx.fillStyle = '#45c080';
	ctx.fillRect(0, 0, width, height);

	// Subtle $ watermark.
	const watermarkSize = Math.floor(Math.min(width, height) * 0.9);
	ctx.save();
	ctx.globalAlpha = 0.12;
	ctx.fillStyle = '#ffffff';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = `900 ${watermarkSize}px "Inter", "Noto Color Emoji", "Noto Sans", "Montserrat", sans-serif`;
	ctx.fillText('$', width / 2, height / 2 - Math.floor(height * 0.03));
	ctx.restore();

	// Border.
	ctx.strokeStyle = '#7fd6a6';
	ctx.lineWidth = borderWidth;
	ctx.strokeRect(EDGE_THICKNESS / 2, EDGE_THICKNESS / 2, width - EDGE_THICKNESS, height - EDGE_THICKNESS);

	// RUNWAY label.
	const labelSize = Math.floor(Math.min(width, height) * 0.16);
	ctx.fillStyle = '#0b3b22';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = `900 ${labelSize}px "Inter", "Noto Color Emoji", "Noto Sans", "Montserrat", sans-serif`;
	ctx.fillText('RUNWAY', width / 2, height / 2);
}

function resolveCardScale(width, height) {
	if (width === TICKET_CARD_SIZE && height === TICKET_CARD_SIZE) {
		return SMALL_CARD_SCALE;
	}
	if (width === ROLE_CARD_WIDTH && height === ROLE_CARD_HEIGHT) {
		return RECT_CARD_SCALE;
	}
	if (width === CARD_SIZE && height === CARD_SIZE) {
		return LARGE_CARD_SCALE;
	}
	return Math.min(width, height) / CARD_SIZE;
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to generate misc cards:', error);
		process.exitCode = 1;
	});
}
