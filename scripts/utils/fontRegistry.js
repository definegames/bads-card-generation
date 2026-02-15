const path = require('path');
const fs = require('fs');
const { registerFont } = require('canvas');

const FONTS_DIR = path.resolve(__dirname, '../../fonts');
const FONT_EXTENSION_REGEX = /\.(ttf|otf)$/i;

const WEIGHT_BY_TOKEN = {
	Thin: '100',
	ExtraLight: '200',
	Light: '300',
	Regular: '400',
	Medium: '500',
	SemiBold: '600',
	Bold: '700',
	ExtraBold: '800',
	Black: '900'
};

function parseFontVariant(filename) {
	const extensionless = filename.replace(FONT_EXTENSION_REGEX, '');
	const firstDashIndex = extensionless.indexOf('-');

	if (firstDashIndex === -1) {
		return null;
	}

	const family = extensionless.slice(0, firstDashIndex);
	const rawVariant = extensionless.slice(firstDashIndex + 1);
	const isItalic = rawVariant.endsWith('Italic');
	const weightToken = isItalic
		? rawVariant.slice(0, -'Italic'.length) || 'Regular'
		: rawVariant;
	const weight = WEIGHT_BY_TOKEN[weightToken] || '400';

	return {
		family,
		weight,
		style: isItalic ? 'italic' : 'normal'
	};
}

// Register all fonts once at module load
function registerFonts() {
	try {
		const fontFiles = fs
			.readdirSync(FONTS_DIR)
			.filter((fileName) => FONT_EXTENSION_REGEX.test(fileName));

		for (const fileName of fontFiles) {
			const parsed = parseFontVariant(fileName);

			if (!parsed) {
				continue;
			}

			registerFont(path.join(FONTS_DIR, fileName), parsed);
		}
	} catch (error) {
		console.error('Error registering fonts:', error.message);
	}
}

// Register fonts immediately when module is loaded
registerFonts();

module.exports = {
	registerFonts
};
