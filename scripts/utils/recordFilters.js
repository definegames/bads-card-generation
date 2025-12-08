const { IGNORE_ADDON_RECORDS } = require('./constants');

function shouldIgnoreRecord(record = {}) {
	if (!IGNORE_ADDON_RECORDS) {
		return false;
	}
	return Boolean(String(record.Addon ?? '').trim());
}

module.exports = {
	shouldIgnoreRecord
};
