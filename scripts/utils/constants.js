const LEGACY_CARD_SIZE = 490;
const LEGACY_SMALL_CARD_SIZE = 410;
const LEGACY_ROLE_CARD_HEIGHT = 490;
const CARD_SIZE = 1004;
const EDGE_THICKNESS = Math.round((40 / LEGACY_CARD_SIZE) * CARD_SIZE);
const CONTENT_PADDING = Math.round((30 / LEGACY_CARD_SIZE) * CARD_SIZE);
const ROLE_CARD_HEIGHT = 1004;
const ROLE_CARD_WIDTH = 766;
const ROLE_CARD_BACKGROUND = '#f6f2ff';
const ROLE_ACCENT_COLOR = '#7d6bff';
const TICKET_CARD_SIZE = 766;
const LARGE_CARD_SCALE = CARD_SIZE / LEGACY_CARD_SIZE;
const SMALL_CARD_SCALE = TICKET_CARD_SIZE / LEGACY_SMALL_CARD_SIZE;
const RECT_CARD_SCALE = ROLE_CARD_HEIGHT / LEGACY_ROLE_CARD_HEIGHT;
const LARGE_CARD_TITLE_LEFT = 119;
const LARGE_CARD_TITLE_TOP = 159;
const LARGE_CARD_TITLE_FONT_SIZE = 64;
const LARGE_CARD_TITLE_FONT_WEIGHT = 500;
const KEYSTONE_BACK_FILE_NAME = 'keystone-back.png';
const MILESTONE_BACK_FILE_NAME = 'milestone-back.png';

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
	DESIGN: { background: '#eb84cc', foreground: '#c5378a' },
	MARKETING: { background: '#ffc774', foreground: '#be700f' },
	TECH: { background: '#d9f0ff', foreground: '#236ad4' }
};
const TICKET_DIRECTIVE_COLORS = {
	open: '#2f855a',
	close: '#c53030',
	action: '#b7791f'
};
const MISC_CARD_TYPES = [
	{ key: 'player-deck', label: 'Player Deck', background: '#fff6cf' },
	{ key: 'work-deck', label: 'Work Deck', background: '#ffe0df', width: TICKET_CARD_SIZE, height: TICKET_CARD_SIZE },
	{ key: 'goal-deck', label: 'Goal', background: '#cbd6e6', borderColor: '#0e1083', width: ROLE_CARD_WIDTH, height: ROLE_CARD_HEIGHT, monogram: false }
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
	LARGE_CARD_SCALE,
	SMALL_CARD_SCALE,
	RECT_CARD_SCALE,
	LARGE_CARD_TITLE_LEFT,
	LARGE_CARD_TITLE_TOP,
	LARGE_CARD_TITLE_FONT_SIZE,
	LARGE_CARD_TITLE_FONT_WEIGHT,
	BACKGROUND_COLOR,
	BODY_TEXT_COLOR,
	IGNORE_ADDON_RECORDS,
	TIER_COLORS,
	TIER_CALLOUTS,
	MILESTONE_BACK_FILE_NAME,
	KEYSTONE_BACK_FILE_NAME,
	CATEGORY_COLORS,
	TICKET_DIRECTIVE_COLORS,
	MISC_CARD_TYPES
};
