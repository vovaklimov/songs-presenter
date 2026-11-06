# Lyric PPTX findings

Notes from the requirements interview on 6 Nov 2026. Use this when building the tool. Confirmed decisions came from the user. Items marked **default** were chosen in planning and were not separately confirmed.

The app itself is a greenfield page. This file is only the record of what to build.

## Why this exists

Importing a bilingual song into ProPresenter should be: paste the lyrics, download a PPTX, import it **with objects and text**, apply an existing ProPresenter theme. The theme styles each language by text-box name. This tool does not author or change that theme.

Box names are the whole contract. Font, size, color, and position in the file are placeholders.

## Product

A local page:

- Two paste areas, labeled `URK` and `ENG`. Either may be left empty.
- A live preview of how the paste splits into slides. It does not preview the PPTX.
- One downloaded file, `lyrics.pptx` (**default** name), containing that one song.

No accounts, song library, songbook import, or editing after generation. Fix the paste and generate again.

Songbook is a neighboring app and is out of scope. There, each language is its own song, and it has no PPTX or ProPresenter export.

## Paste contract

Each language is its own plain-text paste. The operator keeps the languages semantically aligned. The tool checks structure only. It never matches lines by meaning.

A slide is one block separated by a blank line. Repeated choruses are already written out as their own blocks. The tool does not expand repeats.

- A block holds **1 or 2** lyric lines. One line on a slide is valid when the operator has made the languages correspond.
- **3 or more** lines in a block is an error. Do not split, merge, or drop lines.
- Block *i* of URK pairs with block *i* of ENG.
- Unequal block counts is an error. Do not leave empty boxes on the extra slides, and do not generate a prefix.

Section names are never slide content. There is no section field in this version.

Text is copied as typed after trim. Chord symbols are not detected or removed (**default**: brackets in a line would show up on the slide).

### Whitespace (default)

The sample already uses blank lines as separators. Treat them this way:

- Trim each line. A line that is empty after trim is a separator.
- Consecutive separators collapse into one.
- Leading and trailing empty blocks are dropped.

### Sample shape

The Ukrainian paste below is the reference shape: every block is two lines, blocks are separated by a blank line, chorus repeats are already written out, and there are no section labels. A future test should turn this into one slide per block.

```text
О! Любові не збагну –
Жертву за гріх принесену.

Розбитий за моє зцілення,
Розп’ятmий щоб я здобув життя.

На хресті – Месія, невинний,
Агнець, Він – надія, Бог вірний

Цар воскреслий, Пан любові,
Вознесенний, вічно в славі.

Алілуя! Переміг Він!
Я омитий, навіки вільний!

О! Дивує знов і знов
Милість, свята Його любов.

Смертний, від смерті щоб спасти,
Відкинений, щоб я був прийнятий.

На хресті – Месія, невинний,
Агнець, Він – надія, Бог вірний

Цар воскреслий, Пан любові,
Вознесенний, вічно в славі.

Алілуя! Переміг Він!
Я омитий, навіки вільний!

На хресті – Месія, невинний,
Агнець, Він – надія, Бог вірний

Цар воскреслий, Пан любові,
Вознесенний, вічно в славі.

Алілуя! Переміг Він!
Я омитий, навіки вільний!

Цар воскреслий, Пан любові,
Вознесенний, вічно в славі.

Алілуя! Переміг Він!
Я омитий, навіки вільний!

Цар воскреслий, Пан любові,
Вознесенний, вічно в славі.

Алілуя! Переміг Він!
Я омитий, навіки вільний!
```

`Розп’ятmий` is in the source paste. Keep it as typed.

## Languages and boxes

Only two box names exist: `URK` and `ENG`. Exact strings.

Write a box only for a language that was pasted. A missing language means that box is **absent**, not an empty box. Ukrainian-only is in scope: every slide has an `URK` box and no `ENG` box.

Both pastes empty: nothing to generate. Empty preview, Download disabled, no error highlight (**default** for the empty state).

A third language, custom box names, and a box that is present but empty are out of scope.

## Preview

Live, on the same page, updating as either paste changes.

- One numbered row per slide (**default**: show the slide number so a bad block can be found).
- URK on the left, ENG on the right.
- Show the lines inside a bad row.
- Highlight a block with 3 or more lines, on that language.
- Highlight the extra blocks when the counts differ.
- An omitted language is an empty side, and that is not an error.
- Download stays disabled until every highlight is gone.

## PPTX

One generation is one song. The file contains lyric slides only: no title slide, no copyright line, no song-name text box.

On each slide, one text box per pasted language:

- Shape name (`cNvPr/@name` in the slide XML) is exactly `URK` or `ENG`. That name is what ProPresenter keeps and what the theme looks up.
- The box holds that block's 1 or 2 lyric lines.
- Two lines are two paragraphs in the text body (**default** implementation of the required line break). One line is a single paragraph.
- Placeholder styling so the raw file is readable before the theme: 16:9 slide, boxes stacked, large font (**default**). Positions are not the contract.

A missing language has no shape on the slide.

## Done when

- The sample paste previews as one row per block and downloads.
- A 3-line block highlights that row and keeps Download off.
- Unequal block counts highlight the extra rows and keep Download off.
- A Ukrainian-only paste produces slides whose only lyric shape is named `URK`.
- Automated check: unzip the PPTX and assert shape names, paragraph text, and the absence of a shape for a language that was not pasted.
- Manual check: import in ProPresenter with objects and text, apply the theme, and see each language in the box of that name.

## Build notes (default)

These were planning choices, not interview answers.

- Static Vite + React + TypeScript page. pnpm. No server, router, or design system.
- Tailwind CSS v4 (`@tailwindcss/vite`) for styling. System sans font, no webfont.
- `react-aria-components` used directly: `TextArea` for the paste areas, `Button` for Download. No songbook `ui/` wrappers.
- Vitest in Node. `tsc --noEmit`.
- A pure split function is the test seam. The React page renders that model.
- Generate with PptxGenJS. Set the shape name via `objectName`. If that does not write `cNvPr/@name`, patch the slide XML inside the pptx zip before download.
- Deploy the `dist/` folder to any static host (Cloudflare Pages or Netlify). Build command `pnpm build`, output `dist/`. No env vars.
- Suggested files: `src/split.ts`, `src/pptx.ts`, `src/App.tsx`, `src/main.tsx`, `index.html`, plus unit tests for the splitter and the unzipped XML.

## Out of scope

- ProPresenter theme authoring.
- Songbook integration or its chord/lyric format.
- Section metadata, even as a note that never enters the PPTX.
- Title, copyright, or song-name slides and boxes.
- Splitting a long stanza into pairs of lines.
- Semantic alignment between languages.
- Accounts, a saved library, or editing the generated deck in the page.
