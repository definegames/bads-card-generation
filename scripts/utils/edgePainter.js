const {
	CARD_SIZE,
	EDGE_THICKNESS,
	EDGE_COLORS,
	STRIPE_COLORS
} = require('./constants');

const EDGE_DEFINITIONS = [
	{ key: 'North edge', position: 'north' },
	{ key: 'East edge', position: 'east' },
	{ key: 'South edge', position: 'south' },
	{ key: 'West edge', position: 'west' }
];

function paintEdgesAndDividers(ctx, record = {}, options = {}) {
	const { edgeColorOverride } = options;
	EDGE_DEFINITIONS.forEach(({ key, position }) => {
		const value = (record[key] || '').trim();
		if (!edgeColorOverride && !value) return;
		drawEdge(ctx, position, value, edgeColorOverride);
	});

	drawCornerDividers(ctx);
}

function drawCornerDividers(ctx) {
	const dividerColor = '#333';
	ctx.save();
	ctx.strokeStyle = dividerColor;
	ctx.lineWidth = 4;
	const lines = [
		[
			{ x: 0, y: 0 },
			{ x: EDGE_THICKNESS, y: EDGE_THICKNESS }
		],
		[
			{ x: CARD_SIZE - EDGE_THICKNESS, y: EDGE_THICKNESS },
			{ x: CARD_SIZE, y: 0 }
		],
		[
			{ x: 0, y: CARD_SIZE },
			{ x: EDGE_THICKNESS, y: CARD_SIZE - EDGE_THICKNESS }
		],
		[
			{ x: CARD_SIZE - EDGE_THICKNESS, y: CARD_SIZE - EDGE_THICKNESS },
			{ x: CARD_SIZE, y: CARD_SIZE }
		]
	];

	lines.forEach(([start, end]) => {
		ctx.beginPath();
		ctx.moveTo(start.x, start.y);
		ctx.lineTo(end.x, end.y);
		ctx.stroke();
	});
	ctx.restore();
}

function drawEdge(ctx, position, code, overrideColor) {
	const rect = edgeRect(position);
	withEdgeClip(ctx, position, () => {
		if (overrideColor) {
			ctx.fillStyle = overrideColor;
			ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
			return;
		}
		if (code === '*') {
			drawStripedEdge(ctx, rect, position);
			return;
		}

		const color = EDGE_COLORS[code] || '#cbd5e0';
		ctx.fillStyle = color;
		ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
	});
}

function drawStripedEdge(ctx, rect, position) {
	const stripeWidth = 10;
	const stripesCount = Math.ceil((position === 'north' || position === 'south' ? rect.width : rect.height) / stripeWidth);
	for (let i = 0; i < stripesCount; i++) {
		const color = STRIPE_COLORS[i % STRIPE_COLORS.length];
		ctx.fillStyle = color;
		if (position === 'north') {
			ctx.fillRect(rect.x + i * stripeWidth, rect.y, stripeWidth, rect.height);
		} else if (position === 'south') {
			ctx.fillRect(rect.x + i * stripeWidth, rect.y, stripeWidth, rect.height);
		} else if (position === 'east') {
			ctx.fillRect(rect.x, rect.y + i * stripeWidth, rect.width, stripeWidth);
		} else if (position === 'west') {
			ctx.fillRect(rect.x, rect.y + i * stripeWidth, rect.width, stripeWidth);
		}
	}
}

function withEdgeClip(ctx, position, drawFn) {
	ctx.save();
	ctx.beginPath();
	createEdgePath(ctx, position);
	ctx.closePath();
	ctx.clip();
	drawFn();
	ctx.restore();
}

function createEdgePath(ctx, position) {
	switch (position) {
		case 'north':
			ctx.moveTo(0, 0);
			ctx.lineTo(CARD_SIZE, 0);
			ctx.lineTo(CARD_SIZE - EDGE_THICKNESS, EDGE_THICKNESS);
			ctx.lineTo(EDGE_THICKNESS, EDGE_THICKNESS);
			break;
		case 'south':
			ctx.moveTo(EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
			ctx.lineTo(CARD_SIZE - EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
			ctx.lineTo(CARD_SIZE, CARD_SIZE);
			ctx.lineTo(0, CARD_SIZE);
			break;
		case 'east':
			ctx.moveTo(CARD_SIZE - EDGE_THICKNESS, EDGE_THICKNESS);
			ctx.lineTo(CARD_SIZE, 0);
			ctx.lineTo(CARD_SIZE, CARD_SIZE);
			ctx.lineTo(CARD_SIZE - EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
			break;
		case 'west':
			ctx.moveTo(0, 0);
			ctx.lineTo(EDGE_THICKNESS, EDGE_THICKNESS);
			ctx.lineTo(EDGE_THICKNESS, CARD_SIZE - EDGE_THICKNESS);
			ctx.lineTo(0, CARD_SIZE);
			break;
		default:
			throw new Error(`Unknown edge position for clip path: ${position}`);
	}
}

function edgeRect(position) {
	switch (position) {
		case 'north':
			return { x: 0, y: 0, width: CARD_SIZE, height: EDGE_THICKNESS };
		case 'south':
			return { x: 0, y: CARD_SIZE - EDGE_THICKNESS, width: CARD_SIZE, height: EDGE_THICKNESS };
		case 'east':
			return { x: CARD_SIZE - EDGE_THICKNESS, y: 0, width: EDGE_THICKNESS, height: CARD_SIZE };
		case 'west':
			return { x: 0, y: 0, width: EDGE_THICKNESS, height: CARD_SIZE };
		default:
			throw new Error(`Unknown edge position: ${position}`);
	}
}

module.exports = {
	paintEdgesAndDividers
};
