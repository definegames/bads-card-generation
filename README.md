# B2B AI Dating SaaS - Card Generation

This repo features the pipeline for generation of all cards for the board game B2B AI Dating SaaS, and the consequent package of those cards into atlases fit to use in Tabletop Simulator.

## Generate the cards

```bash
yarn install
yarn generate
```

When needed, you can run the generators individually:

```bash
yarn generate:abilities
yarn generate:features
yarn generate:milestones
yarn generate:roles
yarn generate:misc
yarn generate:atlases
```
