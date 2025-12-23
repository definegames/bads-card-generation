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
const TIER_COLORS = {
	0: '#b4bcc6',
	1: '#6dd19c',
	2: '#ffb169',
	3: '#ff6b6b'
};
const TIER_CALLOUTS = {
	default: {
		1: 'Regroup: each player may shuffle their hand into the deck, then draw 2 cards.',
		2: 'Pivot: the CEO may rearrange 1 to 6 Features, then roll a die. If the result is less than the number of moved Features, add 1 Ticket on top of each moved Feature.',
		3: 'You win!'
	},
	ru: {
		1: 'Regroup: каждый игрок может замешать свою руку в колоду, затем взять 2 карты.',
		2: 'Pivot: CEO может переставить от 1 до 6 Фич, затем бросить кубик. Если результат меньше числа перемещённых Фич, положите по 1 Тикету поверх каждой из них.',
		3: 'Вы победили!'
	}
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
	TIER_COLORS,
	TIER_CALLOUTS,
	CATEGORY_COLORS,
	MISC_CARD_TYPES
};
