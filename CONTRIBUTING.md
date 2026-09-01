# Contributing

This repository publishes the Alkanes protocol documentation site. Corrections are welcome, particularly to
anything factual.

## The ground rule

**Every factual claim must be checkable in this organisation's own code**, primarily
[bitcoinuniverseio/alkanes-rs](https://github.com/bitcoinuniverseio/alkanes-rs). If you cannot point at the
source file that makes something true, do not state it.

- Code being present is not the same as a capability being released. Do not claim wallet, marketplace, or
  indexer support that is not wired up in the organisation's code.
- When something is not supported, say so plainly rather than omitting it.
- Upstream protocols (Runes, protorunes, and Alkanes itself) originated outside this organisation. Attribute
  them honestly and mark Bitcoin Universe specific decisions as such.
- Never invent a byte string. Script hex on this site is produced by encoding real inputs and decoding the
  result back. If you add a vector, generate it and round-trip it.

## Style

- No em dash characters anywhere. Use commas, colons, periods, or parentheses.
- Plain, direct writing. No filler, no unsupported superlatives, no placeholder sections, no "coming soon".
- Prefer a diagram or a table over a wall of text.

## Technical constraints

- Static HTML, CSS, and vanilla JavaScript. No build step, no framework, no external CDNs, no external fonts,
  no trackers.
- Every ordinary page must work with JavaScript disabled. JavaScript may only enhance search, the theme
  toggle, and the protostone tool.
- Dark and light themes must both meet WCAG 2.2 AA contrast.
- Responsive down to 320px with no horizontal page overflow. Wide tables and code scroll inside their own
  container.
- Semantic landmarks, a skip link, visible focus, correct heading order, and text alternatives on every
  diagram.
- Inline SVG only, with `<title>` and `<desc>`, using CSS custom properties so both themes work.
- Budgets: under 50KB of CSS, under 60KB of JavaScript, no image over 200KB.

## Making a change

1. Edit the relevant page. Each page footer has an edit-on-GitHub link.
2. If you added or renamed an `h2` or `h3`, regenerate `search-index.json` rather than hand-editing it.
3. If you changed a page's subject, update `llms.txt` and `sitemap.xml`.
4. Check the page at 320px wide and in both themes.
5. Open a pull request describing what you changed and, for factual changes, the source file that supports it.

## Adding a test vector

1. Encode the inputs with the layered encoding described on the encoding page.
2. Decode the result and confirm the integers come back unchanged.
3. State the expected indexer outcome, including cases where the correct behaviour is to produce no error.
