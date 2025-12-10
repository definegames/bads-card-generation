const { isRuLocale } = require('./runtimeConfig');

function getLocalizedText(record, fallbackKeys = []) {
	if (isRuLocale) {
		const ruValue = (record['RU Text'] || '').trim();
		if (ruValue) {
			return ruValue;
		}
	}

	for (const key of fallbackKeys) {
		const value = (record[key] || '').trim();
		if (value) {
			return value;
		}
	}

	return '';
}

module.exports = {
	getLocalizedText
};
