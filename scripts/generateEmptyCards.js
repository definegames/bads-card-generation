#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
require('./utils/fontRegistry'); // Register fonts
const { drawFeatureCard } = require('./generateFeatures');
const { drawAbilityCard } = require('./generateAbilities');
const { drawKeystoneFront } = require('./generateKeystones');
const { drawMilestoneFront } = require('./generateMilestones');
const { drawRoleCard } = require('./generateRoles');
const { drawGoalCard } = require('./generateGoals');
const { drawTicketCard } = require('./generateTickets');
const { drawProblemCard } = require('./generateProblems');
const { resolveOutputPath } = require('./utils/runtimeConfig');

async function main() {
	const miscDir = resolveOutputPath('misc');
	await fs.mkdir(miscDir, { recursive: true });

	const templates = [
		{ task: () => drawFeatureCard(path.join(miscDir, 'feature-empty.png'), createFeatureRecord(), { blank: true }) },
		{ task: () => drawAbilityCard(path.join(miscDir, 'ability-empty.png'), createAbilityRecord(), { blank: true }) },
		{ task: () => drawKeystoneFront(path.join(miscDir, 'keystone-empty.png'), createKeystoneRecord(), { blank: true }) },
		{ task: () => drawMilestoneFront(path.join(miscDir, 'milestone-empty.png'), createMilestoneRecord(), { blank: true }) },
		{ task: () => drawRoleCard(path.join(miscDir, 'role-empty.png'), createRoleRecord(), { blank: true }) },
		{ task: () => drawGoalCard(path.join(miscDir, 'goal-empty.png'), createGoalRecord(), { blank: true }) },
		{ task: () => drawTicketCard(path.join(miscDir, 'ticket-empty.png'), createTicketRecord(), { blank: true }) },
		{ task: () => drawProblemCard(path.join(miscDir, 'problem-empty.png'), createProblemRecord(), { blank: true }) }
	];

	await Promise.all(templates.map((template) => template.task()));

	console.log(`Generated ${templates.length} blank card templates in ${miscDir}`);
}

function createFeatureRecord() {
	return {
		Title: '',
		Markets: '',
		'Funny text': '',
		'Text': '',
		Text: '',
		'Score Points': '',
		'North edge': '-',
		'East edge': '-',
		'South edge': '-',
		'West edge': '-',
		__blank: true
	};
}

function createKeystoneRecord() {
	return {
		Title: '',
		Text: '',
		'Funny text': '',
		'North edge': '-',
		'East edge': '-',
		'South edge': '-',
		'West edge': '-',
		__blank: true
	};
}

function createMilestoneRecord() {
	return {
		Title: '',
		Text: '',
		'Funny text': '',
		'ACF': 0,
		'Minimum Score': 0,
		Deadline: '',
		'North edge': '-',
		'East edge': '-',
		'South edge': '-',
		'West edge': '-',
		__blank: true
	};
}

function createAbilityRecord() {
	return {
		Title: '',
		Text: '',
		'Funny text': '',
		__blank: true
	};
}

function createRoleRecord() {
	return {
		Title: '',
		Text: '',
		'Funny text': '',
		__blank: true
	};
}

function createGoalRecord() {
	return {
		Title: '',
		Text: '',
		__blank: true
	};
}

function createTicketRecord() {
	return {
		Category: 'TECH',
		Title: '',
		'Counter slots': 0,
		'Slot type': '▢',
		'Text': '',
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
