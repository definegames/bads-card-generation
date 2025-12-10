#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { drawFeatureCard } = require('./generateFeatures');
const { drawAbilityCard } = require('./generateAbilities');
const { drawMilestoneFront, drawMilestoneBack } = require('./generateMilestones');
const { drawRoleCard } = require('./generateRoles');
const { drawTicketCard } = require('./generateTickets');
const { drawProblemCard } = require('./generateProblems');

async function main() {
	const miscDir = path.resolve(__dirname, '../outputs/misc');
	await fs.mkdir(miscDir, { recursive: true });

	const templates = [
		{ file: 'feature-empty.png', task: () => drawFeatureCard(path.join(miscDir, 'feature-empty.png'), createFeatureRecord(), { blank: true }) },
		{ file: 'ability-empty.png', task: () => drawAbilityCard(path.join(miscDir, 'ability-empty.png'), createAbilityRecord(), { blank: true }) },
		{ file: 'milestone-empty-front.png', task: () => drawMilestoneFront(path.join(miscDir, 'milestone-empty-front.png'), createMilestoneRecord(), { blank: true }) },
		{ file: 'milestone-empty-back.png', task: () => drawMilestoneBack(path.join(miscDir, 'milestone-empty-back.png'), createMilestoneRecord(), { blank: true }) },
		{ file: 'role-empty.png', task: () => drawRoleCard(path.join(miscDir, 'role-empty.png'), createRoleRecord(), { blank: true }) },
		{ file: 'ticket-empty.png', task: () => drawTicketCard(path.join(miscDir, 'ticket-empty.png'), createTicketRecord(), { blank: true }) },
		{ file: 'problem-empty.png', task: () => drawProblemCard(path.join(miscDir, 'problem-empty.png'), createProblemRecord(), { blank: true }) }
	];

	await Promise.all(templates.map((template) => template.task()));

	console.log(`Generated ${templates.length} blank card templates in ${miscDir}`);
}

function createFeatureRecord() {
	return {
		Title: '',
		Markets: '',
		'Funny text': '',
		'Text (SA - Special Ability; OC - On Completion)': '',
		Text: '',
		'Score Points': '',
		'North edge': 'A',
		'East edge': 'B',
		'South edge': 'C',
		'West edge': 'A',
		__blank: true
	};
}

function createAbilityRecord() {
	return {
		Title: '',
		Text: '',
		'Funny text': '',
		'North edge': 'A',
		'East edge': 'B',
		'South edge': 'C',
		'West edge': 'A',
		__blank: true
	};
}

function createMilestoneRecord() {
	return {
		Title: '',
		Text: '',
		'Funny text': '',
		Tier: 0,
		TCF: 0,
		ACF: 0,
		MTS: 0,
		'North edge': 'A',
		'East edge': 'B',
		'South edge': 'C',
		'West edge': 'A',
		__blank: true
	};
}

function createRoleRecord() {
	return {
		Title: '',
		Order: '00',
		Text: '',
		'Funny text': '',
		__blank: true
	};
}

function createTicketRecord() {
	return {
		Category: 'TECH',
		Title: '',
		'Counter slots': 0,
		'Slot type': '▢',
		'Text (SA - Special Ability; WS - When Starting; OC - On Closing)': '',
		Text: '',
		'Funny text': '',
		__blank: true
	};
}

function createProblemRecord() {
	return {
		Title: '',
		Text: '',
		'Funny text': '',
		__blank: true
	};
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to generate empty cards:', error);
		process.exitCode = 1;
	});
}
