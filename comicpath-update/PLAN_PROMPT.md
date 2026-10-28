# ComicPath — Major Update: Planning Request

## How to work on this
- Use plan mode. DO NOT write or change code until I approve the plan.
- Work one phase at a time. After each phase: run the app, confirm the
  acceptance criteria, commit to a feature branch with a clear message,
  then STOP and wait for my go-ahead before the next phase.
- Every phase must leave the app in a working state. No phase may depend
  on a later phase to un-break something.
- Keep the existing separation of concerns (API/prompt logic, state/hooks,
  styles, components stay isolated).
- Visuals are lo-fi wireframe only. Final look and feel is TBD; build
  structure and interaction, not polish. Keep CSS easy to replace.
- If anything in this request is ambiguous or conflicts with the current
  code, ask me. Don't guess.

## Phase 0 — Audit (no code changes)
Before planning, read the codebase and /design-ref, then report back:
1. Current file/component map, including the constellation / reading path
   view and how Full Guide / Catch Up / Deep Dive / Build modes are
   implemented.
2. How a "seed node" is currently represented, selected, and passed to
   the AI and the canvas (data shape, state, prompt).
3. Where tier/category data comes from and how it's named in code and in
   persisted data (localStorage).
4. What existing behavior could break with these changes (saved reading
   lists, routes, persisted state).
5. A short summary of the primary design reference (see Phase 5) so I can
   confirm you've read it correctly.
Then give me a phased plan using the phases below, adjusted to what you
found. List the files each phase touches.

## Phase 1 — Data model: multiple seeds + 3 categories
Goal: the data layer supports one or many seeds and a consistent
category on every node. UI can stay as-is, adapted only enough to keep
working.
- A canvas holds 1..n seeds. Seed types: character, group, story arc.
  Examples of single seeds: Batman (character), Batman & Robin (group),
  Absolute Power (story arc).
- A group seed (e.g. Batman & Robin as one seed) = titles where they
  appear together. Multiple seeds (Batman + Robin as two seeds) = titles
  for each one individually, plus crossovers where both appear.
- Every node/title gets exactly one category:
  - essential — Must read: canon for this path
  - optional — Might read: worth reading, alternate or Elseworlds
  - skip — Not needed: safe to pass on
- These replace the old four tiers. Mapping: Canon & Essential → essential;
  Worth Reading and Elseworlds & Alternates → optional; You Can Skip → skip.
- QUESTION FOR ME before you build: how should existing saved data in
  localStorage be migrated to the new categories (auto-migrate on load,
  or reset)?
- Update the AI response schema/prompt to return seeds + categorized
  nodes in this shape.
Acceptance: an existing single-seed flow still produces correct
results under the new model; old saved data loads without errors.

## Phase 2 — Intent resolution + clarifying questions
Goal: from one free-text prompt, the system works out (a) the seed(s)
and (b) the mode, and asks a clarifying question when either is unclear.
- Seeds come from the prompt — no separate seed search/selection step.
- Unclear entity → ask. Example: "show important Sandman content" →
  which Sandman?
- Unclear seed structure → ask. Example: "titles about Batman and
  Robin" → only titles with both together (group seed), or each
  individually including crossovers (two seeds)?
- Unclear mode → ask: Full guide (I'm new) / Catch up (I'm familiar,
  getting back in) / Deep dive (the more obscure good stuff).
  Build mode is merged into this single flow, not a separate choice.
- Every clarifying question is multiple choice with an "Other"
  free-text option.
- Propose a structured response contract for this (e.g. the AI returns
  either a clarification object with question + options, or results)
  and show it to me before implementing.
- Keep the existing default-to-mainstream-continuity disambiguation
  behavior.
Acceptance: the Sandman, Batman & Robin, and unclear-mode examples each
trigger the right question; a clear prompt (e.g. "catch me up on
Absolute Power") goes straight to results with no question.

## Phase 3 — Home screen
Goal: a single search entry point.
- Replace the Full Guide / Catch Up / Deep Dive / Build options with one
  search input.
- Submitting goes through Phase 2 resolution, then to the canvas + chat
  drawer view (formerly the constellation / reading path view).
- Remove dead code for the old mode picker and seed selector; don't
  leave orphaned components or routes.
Acceptance: the only path from home is the single search; old mode
entry points are gone; no console errors.

## Phase 4 — Canvas + chat drawer
Goal: results and clarifying questions live in the canvas/chat drawer.
- Clarifying questions appear in the chat drawer as multiple-choice
  options + Other.
- Canvas renders 1..n seeds and their nodes, with crossover nodes
  visibly connected to each seed they involve.
- Every node shows its category (essential / optional / skip)
  consistently.
Acceptance: single-seed, group-seed, and multi-seed canvases all render
correctly from the Phase 2 examples.

## Phase 5 — Canvas UI refresh (lo-fi)
Goal: match the layout and interactions in /design-ref — structure only.
Primary reference: /design-ref/primary/ArrowsMetroB7-x0rp.dc.html
("Metro lines — Path B starts at Title 7"). Files in
/design-ref/explorations are earlier explorations; use them only where
the primary one is silent.
Build:
- Title cards with an Essential / Optional / Skip tag and Expand action
- Tinted regions grouping titles by seed (character, group, story arc)
- Connectors: solid = read first, dashed = enhances/optional,
  no line = standalone
- Reading paths (A/B…): hover to trace, click to pin, "Continue with
  Path B" handoff
- Skip with undo/reset, plus a "Show skipped titles" toggle
- Reading view: ordered list per path, "Back to map"
- Title details panel: cover + synopsis placeholders, Read before /
  Read after lists, Open / Save actions
- A legend explaining lines and categories
The .dc.html files are mockup source written for a separate design-tool
runtime (they reference a support.js that isn't included and won't run
standalone). Read them for layout, states, data shapes and interaction
logic; don't copy the runtime or markup syntax into the app.
Treat this as a wireframe, not final visual design.
Acceptance: layout and interactions match the primary reference; styles
stay isolated and replaceable.

## Start now with Phase 0 only.
