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
yarn generate:tickets
yarn generate:problems
yarn generate:atlases
yarn generate:print
```

### Print-ready sheets

`yarn generate:print` arranges every card face together with the correct back on portrait A4 sheets inside `outputs/print`. Each sheet is exported as a PNG pair (`sheet-XXX-front/back.png`), and the full set is bundled into `outputs/print/bads-double-sided-cards.pdf` in front/back order. Print double-sided with "flip on long edge" to keep the backs aligned after cutting.

- Feature & ability cards now carry the Player Deck back and print at roughly 85×85 mm.
- Ticket & problem cards stay on the Work Deck back but print at ~78×78 mm so they remain slightly smaller than feature cards (the colored edge stays visible when stacked).
- Role cards expand to about 75×100 mm to give them a more premium footprint.
