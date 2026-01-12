"use client";

import { useMemo, useState } from 'react';

const SECTION_CONFIG = [
	{
		key: 'playerDeck',
		title: 'Player Deck',
		atlasMatchers: [/ability/i, /feature/i],
		miscMatchers: [/player-deck/i]
	},
	{
		key: 'workDeck',
		title: 'Work Deck',
		atlasMatchers: [/ticket/i, /problem/i],
		miscMatchers: [/work-deck/i]
	},
	{
		key: 'roles',
		title: 'Roles',
		atlasMatchers: [/role/i]
	},
	{
		key: 'keystones',
		title: 'Keystones',
		atlasMatchers: [/keystone/i],
		miscMatchers: [/keystone-back/i]
	},
	{
		key: 'milestones',
		title: 'Milestones',
		atlasMatchers: [/milestone/i],
		miscMatchers: [/milestone-back/i]
	},
	{
		key: 'goals',
		title: 'Goals',
		atlasMatchers: [/goal/i],
		miscMatchers: [/goal-deck/i]
	}
];

function matchesPattern(value, matchers = []) {
	if (!matchers?.length) {
		return false;
	}
	return matchers.some((matcher) =>
		typeof matcher === 'function' ? matcher(value) : matcher?.test?.(value)
	);
}

function extractMatches(items, matchers = [], valueAccessor = (item) => item) {
	if (!matchers?.length) {
		return { matches: [], rest: items };
	}
	const matches = [];
	const rest = [];
	items.forEach((item) => {
		const value = valueAccessor(item);
		if (matchesPattern(value, matchers)) {
			matches.push(item);
		} else {
			rest.push(item);
		}
	});
	return { matches, rest };
}

export default function AtlasLocaleSwitcher({ assetsByLocale }) {
	const localeOptions = useMemo(() => Object.keys(assetsByLocale || {}).sort(), [assetsByLocale]);
	const [selectedLocale, setSelectedLocale] = useState(localeOptions[0] || 'default');

	if (!localeOptions.length) {
		return (
			<>
				<section>
					<h2>Atlases</h2>
					<p>No atlases have been generated yet.</p>
				</section>
				<section>
					<h2>Misc Assets</h2>
					<p>No misc files have been generated yet.</p>
				</section>
			</>
		);
	}

	const currentLocale = assetsByLocale[selectedLocale] ?? { atlases: [], misc: [] };
	const localeAtlases = currentLocale.atlases ?? [];
	const localeMisc = currentLocale.misc ?? [];
	const sections = useMemo(() => {
		let remainingAtlases = [...localeAtlases];
		let remainingMisc = [...localeMisc];
		return SECTION_CONFIG.map((section) => {
			const { matches: atlasItems, rest: updatedAtlases } = extractMatches(
				remainingAtlases,
				section.atlasMatchers,
				(item) => item.name
			);
			const { matches: miscItems, rest: updatedMisc } = extractMatches(
				remainingMisc,
				section.miscMatchers,
				(item) => item
			);
			remainingAtlases = updatedAtlases;
			remainingMisc = updatedMisc;
			return {
				...section,
				atlasItems,
				miscItems
			};
		});
	}, [localeAtlases, localeMisc]);

	return (
		<>
			<div className="locale-switcher">
				<label htmlFor="locale-select">Locale</label>
				<select
					id="locale-select"
					value={selectedLocale}
					onChange={(event) => setSelectedLocale(event.target.value)}
				>
					{localeOptions.map((locale) => (
						<option key={locale} value={locale}>
							{locale.toUpperCase()}
						</option>
					))}
				</select>
			</div>

			{sections.map((section) => {
				const combinedItems = [
					...section.atlasItems.map((file) => ({
						key: file.name,
						label: file.name,
						badge: file.cardCount ? `${file.cardCount} cards` : 'card count unknown',
						url: `/atlases/${selectedLocale}/${file.name}`
					})),
					...section.miscItems.map((file) => ({
						key: file,
						label: file,
						badge: null,
						url: `/misc/${selectedLocale}/${file}`
					}))
				];
				return (
					<section key={section.key}>
						<h2>{section.title}</h2>
						{combinedItems.length ? (
							<ul>
								{combinedItems.map((item) => (
									<li key={item.key}>
										<a href={item.url} target="_blank" rel="noopener noreferrer">
											{item.label}
										</a>
										{item.badge && <span className="badge">{item.badge}</span>}
									</li>
								))}
							</ul>
						) : (
							<p>No assets in this section yet.</p>
						)}
					</section>
				);
			})}
		</>
	);
}
