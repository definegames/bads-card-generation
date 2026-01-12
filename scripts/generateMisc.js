#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas, loadImage } = require('canvas');
require('./utils/fontRegistry'); // Register fonts
const {
	CARD_SIZE,
	EDGE_THICKNESS,
	CONTENT_PADDING,
	BODY_TEXT_COLOR,
	MISC_CARD_TYPES
} = require('./utils/constants');
const { resolveOutputPath } = require('./utils/runtimeConfig');

async function main() {
	const outputDir = resolveOutputPath('misc');
	await fs.mkdir(outputDir, { recursive: true });
	const runwayPath = path.resolve(__dirname, '../images/runway.jpg');

	await Promise.all(
		MISC_CARD_TYPES.map(async (card) => {
			const width = card.width ?? CARD_SIZE;
			const height = card.height ?? CARD_SIZE;
			const canvas = createCanvas(width, height);
			const ctx = canvas.getContext('2d');
			if (card.key === 'player-deck') {
				const image = await loadImage(runwayPath);
				drawImageCover(ctx, image, width, height);
				// Keep border styling consistent with other backs.
				ctx.strokeStyle = '#d4cdc3';
				ctx.lineWidth = 4;
				ctx.strokeRect(EDGE_THICKNESS / 2, EDGE_THICKNESS / 2, width - EDGE_THICKNESS, height - EDGE_THICKNESS);
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
	ctx.fillStyle = card.background;
	ctx.fillRect(0, 0, width, height);

	ctx.strokeStyle = '#d4cdc3';
	ctx.lineWidth = 4;
	ctx.strokeRect(EDGE_THICKNESS / 2, EDGE_THICKNESS / 2, width - EDGE_THICKNESS, height - EDGE_THICKNESS);

	const monogramSize = Math.floor(Math.min(width, height) * 0.55);
	const labelSize = Math.floor(Math.min(width, height) * 0.16);

	if (card.monogram !== false) {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = '#ffffff18';
		ctx.font = `900 ${monogramSize}px "Montserrat", "Noto Color Emoji", sans-serif`;
		ctx.fillText(card.label.slice(0, 1), width / 2, height / 2);
	}

	ctx.fillStyle = card.textColor || BODY_TEXT_COLOR;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = `800 ${labelSize}px "Montserrat", "Noto Color Emoji", sans-serif`;
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

function drawImageCover(ctx, image, targetWidth, targetHeight) {
	const sourceWidth = image.width;
	const sourceHeight = image.height;
	if (!sourceWidth || !sourceHeight) {
		return;
	}

	const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
	const drawWidth = sourceWidth * scale;
	const drawHeight = sourceHeight * scale;
	const dx = (targetWidth - drawWidth) / 2;
	const dy = (targetHeight - drawHeight) / 2;
	ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to generate misc cards:', error);
		process.exitCode = 1;
	});
}
