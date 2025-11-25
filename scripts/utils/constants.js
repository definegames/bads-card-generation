const CARD_SIZE = 490;
const EDGE_THICKNESS = 40;
const CONTENT_PADDING = 30;

const BACKGROUND_COLOR = '#fdf7f2';
const BODY_TEXT_COLOR = '#1f1f1f';
const EDGE_COLORS = {
	A: '#ff6b6b',
	B: '#4ecdc4',
	C: '#ffd166'
};
const STRIPE_COLORS = [EDGE_COLORS.A, EDGE_COLORS.B, EDGE_COLORS.C];
const TIER_COLORS = {
	0: '#b4bcc6',
	1: '#6dd19c',
	2: '#ffb169',
	3: '#ff6b6b'
};
const CATEGORY_COLORS = {
	DESIGN: { background: '#ffe3f3', foreground: '#a32c68' },
	TECH: { background: '#d9f5ff', foreground: '#005d8f' },
	MARKETING: { background: '#fff2d6', foreground: '#a35a00' }
};

module.exports = {
	CARD_SIZE,
	EDGE_THICKNESS,
	CONTENT_PADDING,
	BACKGROUND_COLOR,
	BODY_TEXT_COLOR,
	EDGE_COLORS,
	STRIPE_COLORS,
	TIER_COLORS,
	CATEGORY_COLORS
};
