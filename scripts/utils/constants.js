const CARD_SIZE = 490;
const EDGE_THICKNESS = 40;
const CONTENT_PADDING = 30;
const ROLE_CARD_HEIGHT = CARD_SIZE;
const ROLE_CARD_WIDTH = Math.round(ROLE_CARD_HEIGHT * 0.75);
const ROLE_CARD_BACKGROUND = '#f6f2ff';
const ROLE_ACCENT_COLOR = '#7d6bff';
const TICKET_CARD_SIZE = CARD_SIZE - EDGE_THICKNESS * 2;

const BACKGROUND_COLOR = '#fdf7f2';
const BODY_TEXT_COLOR = '#1f1f1f';
const IGNORE_ADDON_RECORDS = true;
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
	MARKETING: { background: '#fff2d6', foreground: '#a35a00' },
	ADMIN: { background: '#f0f0f0', foreground: '#808080' }
};
const MISC_CARD_TYPES = [
	{ key: 'role', label: 'Role', background: '#dceeff', textColor: '#0c356b', width: ROLE_CARD_WIDTH, height: ROLE_CARD_HEIGHT },
	{ key: 'player-deck', label: 'Player Deck', background: '#fff6cf' },
	{ key: 'work-deck', label: 'Work Deck', background: '#ffe0df', width: TICKET_CARD_SIZE, height: TICKET_CARD_SIZE }
];

module.exports = {
	CARD_SIZE,
	EDGE_THICKNESS,
	CONTENT_PADDING,
	ROLE_CARD_HEIGHT,
	ROLE_CARD_WIDTH,
	ROLE_CARD_BACKGROUND,
	ROLE_ACCENT_COLOR,
	TICKET_CARD_SIZE,
	BACKGROUND_COLOR,
	BODY_TEXT_COLOR,
	IGNORE_ADDON_RECORDS,
	EDGE_COLORS,
	STRIPE_COLORS,
	TIER_COLORS,
	CATEGORY_COLORS,
	MISC_CARD_TYPES
};
