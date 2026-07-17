---
name: data-audit
description: Admit football datasets and visual assets with provenance, licensing, schema, and product-use checks.
---

# Data Audit

For every dataset or asset, record source URL, publisher, retrieval date,
version/season, license or terms, local path, SHA-256, schema/unit, coverage,
known gaps, and exact product decision it powers in `data/source-manifest.json`.

Keep raw files ignored under `data/raw/`. Publish only licensed derived data
under `public/data/`, with an explicit transformation script and attribution.
Do not infer event-level tactics from aggregate team totals without labeling the
limitation. Player identity, flag, crest, photo, font, and icon rights require
separate review; a public URL does not imply reuse permission.

Run `pnpm data:audit`. `pending` sources may remain during discovery, but no UI
claim becomes evidence-backed until its source is `accepted`, reproducible, and
connected to a tested domain calculation.

Output: PASS, REVISE, or REJECT; provenance; rights state; product use; gaps;
and the next transformation/test.
