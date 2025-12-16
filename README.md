# B2B AI Dating SaaS - Card Generation

This repo features the pipeline for generation of all cards for the board game B2B AI Dating SaaS, and the consequent package of those cards into atlases fit to use in Tabletop Simulator.

## Setup

### 1. Install dependencies

```bash
yarn install
```

### 2. Download fonts

The card generators require fonts to be placed in the `fonts/` directory. Download these three font files:

```bash
mkdir -p fonts
cd fonts

# Noto Sans (for body text)
wget "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf"
wget "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf"

# Noto Color Emoji (for emoji rendering - REQUIRED)
wget "https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf"

cd ..
```

**Note:** The NotoColorEmoji.ttf font is essential for proper emoji rendering (🅰️, 🚀, etc.). Without it, emojis will appear as boxes with Unicode codes.

## Generate the cards

```bash
yarn generate
```

The `generate` script now runs the entire pipeline twice: first with the English copy (the `Text` column) into `outputs/`, then again using the `RU Text` column into `outputs_ru/`. Both trees share the same subfolder structure (features, abilities, print, etc.), so you can keep localized assets side by side. Titles remain unchanged; only the primary body copy swaps to its RU counterpart.

To build a single locale manually you can run the shared asset chain with custom environment variables, e.g.:

```bash
OUTPUT_ROOT=outputs_ru LOCALE=ru yarn generate:assets
```

Every locale pass copies its atlases and misc assets into `public/atlases/<locale>` and `public/misc/<locale>` respectively. The Next.js app surfaces these folders through the locale switcher at the top of the page.

When needed, you can run the generators individually:

```bash
yarn generate:abilities
yarn generate:features
yarn generate:milestones
yarn generate:roles
yarn generate:misc
yarn generate:tickets
yarn generate:problems
yarn generate:blanks
yarn generate:atlases
yarn generate:print
yarn generate-print
```

### Print-ready sheets

`yarn generate:print` arranges every card face together with the correct back on portrait A4 sheets inside `outputs/print`. Each sheet is exported as a PNG pair (`sheet-XXX-front/back.png`), and the full set is bundled into `outputs/print/bas-double-sided-cards-<locale>.pdf` in front/back order. Print double-sided with "flip on long edge" to keep the backs aligned after cutting.

Use `yarn generate-print` to render both locales back-to-back; it runs the same print compiler for `outputs/` (English) and `outputs_ru/` (Russian), emitting PDFs with `-en` / `-ru` suffixes respectively.

When the RU locale runs, the same layout logic places its sheets inside `outputs_ru/print` while still referencing the localized copy from `RU Text`.

- Feature & ability cards now carry the Player Deck back and print at roughly 85×85 mm.
- Ticket & problem cards stay on the Work Deck back but print at ~78×78 mm so they remain slightly smaller than feature cards (the colored edge stays visible when stacked).
- Role cards expand to about 75×100 mm to give them a more premium footprint.
- The blank template generator (`yarn generate:blanks`) creates one "empty" version of each card type without title/text. The print compiler uses these files to pad every sheet to a full grid and also adds one extra all-empty sheet per card family (see `EXTRA_EMPTY_SHEETS` in `scripts/compilePrintSheets.js`). Use the spare cards to hand-write quick prototypes or replacements when playtesting.
