const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_OUTPUT_ROOT = path.join(PROJECT_ROOT, 'outputs');
const OUTPUT_ROOT = path.resolve(PROJECT_ROOT, process.env.OUTPUT_ROOT || 'outputs');
const LOCALE = (process.env.LOCALE || 'default').toLowerCase();
const isRuLocale = LOCALE === 'ru';

function resolveOutputPath(...segments) {
	return path.join(OUTPUT_ROOT, ...segments);
}

module.exports = {
	PROJECT_ROOT,
	OUTPUT_ROOT,
	DEFAULT_OUTPUT_ROOT,
	LOCALE,
	isRuLocale,
	resolveOutputPath
};
