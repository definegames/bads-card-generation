const path = require('path');
const fs = require('fs');
const { registerFont } = require('canvas');

const FONTS_DIR = path.resolve(__dirname, '../../fonts');

// Register all fonts once at module load
function registerFonts() {
	try {
		const interRegular = path.join(FONTS_DIR, 'Inter-Regular.ttf');
		const interBold = path.join(FONTS_DIR, 'Inter-Bold.ttf');

		if (fs.existsSync(interRegular)) {
			registerFont(interRegular, { family: 'Inter', weight: '400' });
			registerFont(interRegular, { family: 'Inter', weight: '500' });
			registerFont(interRegular, { family: 'Inter', weight: '600' });
		}

		if (fs.existsSync(interBold)) {
			registerFont(interBold, { family: 'Inter', weight: '700' });
			registerFont(interBold, { family: 'Inter', weight: '800' });
			registerFont(interBold, { family: 'Inter', weight: '900' });
		}

		const notoRegular = path.join(FONTS_DIR, 'NotoSans-Regular.ttf');
		const notoBold = path.join(FONTS_DIR, 'NotoSans-Bold.ttf');

		if (fs.existsSync(notoRegular)) {
			registerFont(notoRegular, { family: 'Noto Sans', weight: '400' });
			registerFont(notoRegular, { family: 'Noto Sans', weight: '500' });
			registerFont(notoRegular, { family: 'Noto Sans', weight: '600' });
		}

		if (fs.existsSync(notoBold)) {
			registerFont(notoBold, { family: 'Noto Sans', weight: '700' });
			registerFont(notoBold, { family: 'Noto Sans', weight: '800' });
		}

		const emojiFont = path.join(FONTS_DIR, 'NotoColorEmoji.ttf');
		if (fs.existsSync(emojiFont)) {
			registerFont(emojiFont, { family: 'Noto Color Emoji' });
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
