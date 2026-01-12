#!/usr/bin/env node
const path = require('path');
const fs = require('fs/promises');
const { PROJECT_ROOT } = require('./utils/runtimeConfig');
const { KEYSTONE_BACK_FILE_NAME, MILESTONE_BACK_FILE_NAME } = require('./utils/constants');

const PUBLIC_ROOT = path.join(PROJECT_ROOT, 'public');
const TIMESTAMP = createTimestamp();
const MISC_DECK_KEYS = new Set([
	'player-deck',
	'work-deck',
	'goal-deck',
	'role-back',
	path.parse(KEYSTONE_BACK_FILE_NAME).name,
	path.parse(MILESTONE_BACK_FILE_NAME).name
]);
const LOCALE_SOURCES = [
	{ code: 'en', outputRoot: path.join(PROJECT_ROOT, 'outputs') },
	{ code: 'ru', outputRoot: path.join(PROJECT_ROOT, 'outputs_ru') }
];

async function main() {
	await resetDirectory(PUBLIC_ROOT);
	await copyAtlasesWithTimestamp();
	await copyDeckBacksWithTimestamp();

	console.log('Synced static atlases and deck backs for en/ru locales into /public with cache-busting timestamps.');
}

async function copyAtlasesWithTimestamp() {
	const baseDest = path.join(PUBLIC_ROOT, 'atlases');
	await resetDirectory(baseDest);
	await Promise.all(
		LOCALE_SOURCES.map(async ({ code, outputRoot }) => {
			const src = path.join(outputRoot, 'atlases');
			const dest = path.join(baseDest, code);
			await copyFilesWithTimestamp({ label: `atlases (${code})`, src, dest });
		})
	);
}

async function copyDeckBacksWithTimestamp() {
	const baseDest = path.join(PUBLIC_ROOT, 'misc');
	await resetDirectory(baseDest);
	await Promise.all(
		LOCALE_SOURCES.map(async ({ code, outputRoot }) => {
			const src = path.join(outputRoot, 'misc');
			const dest = path.join(baseDest, code);
			await copyFilesWithTimestamp({
				label: `deck backs (${code})`,
				src,
				dest,
				filter: (file) => MISC_DECK_KEYS.has(path.parse(file).name)
			});
		})
	);
}

async function copyFilesWithTimestamp({ label, src, dest, filter }) {
	const entries = await readDirectorySafe(src);
	const files = typeof filter === 'function' ? entries.filter(filter) : entries;
	if (!files.length) {
		console.warn(`No files found for ${label} in ${src}, skipping.`);
		return;
	}
	await fs.mkdir(dest, { recursive: true });
	await Promise.all(
		files.map(async (file) => {
			const targetName = addTimestampSuffix(file, TIMESTAMP);
			await fs.copyFile(path.join(src, file), path.join(dest, targetName));
		})
	);
}

async function readDirectorySafe(dir) {
	try {
		return await fs.readdir(dir);
	} catch (error) {
		if (error.code === 'ENOENT') {
			console.warn(`Directory not found: ${dir}. Skipping.`);
			return [];
		}
		throw error;
	}
}

async function resetDirectory(dir) {
	await fs.rm(dir, { recursive: true, force: true });
	await fs.mkdir(dir, { recursive: true });
}

function addTimestampSuffix(fileName, timestamp) {
	const ext = path.extname(fileName);
	const base = path.basename(fileName, ext);
	return `${base}-${timestamp}${ext}`;
}

function createTimestamp() {
	return new Date()
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}Z$/, 'Z')
		.replace('T', '');
}
if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to sync static assets:', error);
		process.exitCode = 1;
	});
}
