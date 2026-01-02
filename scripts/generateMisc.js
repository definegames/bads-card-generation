#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('canvas');
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

	await Promise.all(
		MISC_CARD_TYPES.map(async (card) => {
			const width = card.width ?? CARD_SIZE;
			const height = card.height ?? CARD_SIZE;
			const canvas = createCanvas(width, height);
			const ctx = canvas.getContext('2d');
			paintCardBack(ctx, card, width, height);
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

	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = '#ffffff18';
	ctx.font = `900 ${monogramSize}px "Montserrat", "Noto Color Emoji", sans-serif`;
	ctx.fillText(card.label.slice(0, 1), width / 2, height / 2);

	ctx.fillStyle = card.textColor || BODY_TEXT_COLOR;
	ctx.font = `800 ${labelSize}px "Montserrat", "Noto Color Emoji", sans-serif`;
	drawLabel(ctx, card, width, height, labelSize);

	if (card.key === 'role') {
		ctx.fillStyle = `${(card.textColor || BODY_TEXT_COLOR)}14`;
		const inset = EDGE_THICKNESS + 30;
		ctx.fillRect(inset, EDGE_THICKNESS + 20, width - inset * 2, height - (EDGE_THICKNESS + 20) * 2);
	}
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

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to generate misc cards:', error);
		process.exitCode = 1;
	});
}
