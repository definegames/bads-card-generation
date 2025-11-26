import fs from 'fs/promises';
import path from 'path';

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
	const match = fileName.match(/-count-(\d+)\.png$/i);
	return match ? Number(match[1]) : null;
}

export default async function HomePage() {
	const [atlasFiles, miscFiles] = await Promise.all([
		readDirectorySafe(ATLASES_DIR),
		readDirectorySafe(MISC_DIR)
	]);

	return (
		<main>
			<header>
				<h1>Card Atlases & Misc Assets</h1>
				<p>
					These PNG files are generated during the Vercel build. Click any link below to download the raw,
					unoptimized artwork.
				</p>
			</header>

			<section>
				<h2>Atlases</h2>
				{atlasFiles.length === 0 ? (
					<p>No atlases have been generated yet.</p>
				) : (
					<ul>
						{atlasFiles.map((file) => {
							const cardCount = extractCardCount(file);
							return (
								<li key={file}>
									<a href={`/atlases/${file}`} target="_blank" rel="noopener noreferrer">
										{file}
									</a>{' '}
									<span className="badge">
										{cardCount ? `${cardCount} cards` : 'card count unknown'}
									</span>
								</li>
							);
						})}
					</ul>
				)}
			</section>

			<section>
				<h2>Misc Assets</h2>
				{miscFiles.length === 0 ? (
					<p>No misc files have been generated yet.</p>
				) : (
					<ul>
						{miscFiles.map((file) => (
							<li key={file}>
								<a href={`/misc/${file}`} target="_blank" rel="noopener noreferrer">
									{file}
								</a>
							</li>
						))}
					</ul>
				)}
			</section>
		</main>
	);
}
