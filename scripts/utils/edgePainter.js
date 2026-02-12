const { CARD_SIZE, EDGE_THICKNESS, LARGE_CARD_SCALE } = require('./constants');

const EDGE_DEFINITIONS = [
	{ key: 'North edge', position: 'north' },
	{ key: 'East edge', position: 'east' },
	{ key: 'South edge', position: 'south' },
	{ key: 'West edge', position: 'west' }
];

function paintEdgesAndDividers(ctx, record = {}) {
	EDGE_DEFINITIONS.forEach(({ key, position }) => {
		const value = (record[key] || '').trim();
		if (value) {
			drawConnector(ctx, position, value);
		}
	});
}

const CONNECTOR_LINE_WIDTH = Math.round(8 * LARGE_CARD_SCALE);
const CONNECTOR_SIZE = EDGE_THICKNESS * 2.8;
const CONNECTOR_RADIUS = CONNECTOR_SIZE * 0.5;
const CONNECTOR_STROKE = '#1e1b16';
const EDGE_CENTER_OFFSET = Math.round(20 * LARGE_CARD_SCALE);

function drawConnector(ctx, position, rawCode) {
	const code = normalizeConnectorCode(rawCode);
	if (!code) {
		return;
	}
	const center = edgeCenter(position);
	if (!center) {
		return;
	}

	withEdgeClip(ctx, position, () => {
		ctx.save();
		ctx.strokeStyle = CONNECTOR_STROKE;
		ctx.lineWidth = CONNECTOR_LINE_WIDTH;
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
		switch (code) {
			case 'R':
				drawSquare(ctx, center, CONNECTOR_SIZE);
				break;
			case 'T':
				drawDiamond(ctx, center, CONNECTOR_SIZE);
				break;
			case 'C':
				drawCircle(ctx, center, CONNECTOR_RADIUS);
				break;
			default:
				break;
		}
		ctx.restore();
	});
}

function normalizeConnectorCode(value) {
	const normalized = String(value || '').trim().toUpperCase();
	if (!normalized || normalized === '-' || normalized === '*') {
		return null;
	}
	return ['R', 'T', 'C'].includes(normalized) ? normalized : null;
}

function drawSquare(ctx, center, size) {
	const half = size / 2;
	ctx.beginPath();
	ctx.rect(center.x - half, center.y - half, size, size);
	ctx.stroke();
}

function drawCircle(ctx, center, radius) {
	ctx.beginPath();
	ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
	ctx.stroke();
}

function drawDiamond(ctx, center, size) {
	const half = size / 2;
	ctx.beginPath();
	ctx.moveTo(center.x, center.y - half);
	ctx.lineTo(center.x + half, center.y);
	ctx.lineTo(center.x, center.y + half);
	ctx.lineTo(center.x - half, center.y);
	ctx.closePath();
	ctx.stroke();
}

function edgeCenter(position) {
	switch (position) {
		case 'north':
			return { x: CARD_SIZE / 2, y: -EDGE_CENTER_OFFSET };
		case 'south':
			return { x: CARD_SIZE / 2, y: CARD_SIZE + EDGE_CENTER_OFFSET };
		case 'east':
			return { x: CARD_SIZE + EDGE_CENTER_OFFSET, y: CARD_SIZE / 2 };
		case 'west':
			return { x: -EDGE_CENTER_OFFSET, y: CARD_SIZE / 2 };
		default:
			return null;
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

module.exports = {
	paintEdgesAndDividers
};
