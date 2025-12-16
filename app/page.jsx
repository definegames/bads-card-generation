import fs from 'fs/promises';
import path from 'path';
import LocaleAssetSwitcher from './components/AtlasLocaleSwitcher';

const ATLASES_DIR = path.join(process.cwd(), 'public', 'atlases');
const MISC_DIR = path.join(process.cwd(), 'public', 'misc');

async function readDirectorySafe(dir) {
	try {
		const entries = await fs.readdir(dir);
		return entries.sort();
	} catch (error) {
		if (error.code === 'ENOENT') {
			return [];
		}
		throw error;
	}
}

function extractCardCount(fileName) {
	const match = fileName.match(/-count-(\d+)(?:-[a-z]+)?(?:-[\da-z]+)?\.png$/i);
	return match ? Number(match[1]) : null;
}

async function readLocaleDirectories(dir) {
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort();
	} catch (error) {
		if (error.code === 'ENOENT') {
			return [];
		}
		throw error;
	}
}

function mapAtlasFiles(files) {
	return files.map((file) => ({
		name: file,
		cardCount: extractCardCount(file)
	}));
}

async function collectAssetsByLocale() {
	const [atlasLocales, miscLocales] = await Promise.all([
		readLocaleDirectories(ATLASES_DIR),
		readLocaleDirectories(MISC_DIR)
	]);
	const localeSet = new Set([...atlasLocales, ...miscLocales]);
	const locales = Array.from(localeSet).sort();

	if (!locales.length) {
		const [rootAtlases, rootMisc] = await Promise.all([
			readDirectorySafe(ATLASES_DIR),
			readDirectorySafe(MISC_DIR)
		]);
		if (!rootAtlases.length && !rootMisc.length) {
			return {};
		}
		return {
			default: {
				atlases: mapAtlasFiles(rootAtlases),
				misc: rootMisc
			}
		};
	}

	const entries = {};
	await Promise.all(
		locales.map(async (locale) => {
			const [atlases, misc] = await Promise.all([
				readDirectorySafe(path.join(ATLASES_DIR, locale)),
				readDirectorySafe(path.join(MISC_DIR, locale))
			]);
			entries[locale] = {
				atlases: mapAtlasFiles(atlases),
				misc: misc
			};
		})
	);
	return entries;
}

export default async function HomePage() {
	const assetsByLocale = await collectAssetsByLocale();

	return (
		<main>
			<header>
				<h1>Card Atlases & Misc Assets</h1>
				<p>
					These PNG files are generated during the Vercel build. Use the locale switcher to grab the English or
					Russian variants of each atlas bundle.
				</p>
			</header>

			<LocaleAssetSwitcher assetsByLocale={assetsByLocale} />
		</main>
	);
}
