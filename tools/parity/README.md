# Parity harness

The parity harness compares a fresh live render with a migrated page at 375,
900, and 1440 pixels. Every width performs a separate live navigation. It does
not read the HTML capture used by the importer.

Run the required published-page backfill:

```sh
node tools/parity/run-parity.mjs \
  --config tools/parity/backfill-pages.json \
  --output parity-results/backfill
```

Use `--page <slug>` to run one configured page. Set `CHROME_PATH` or pass
`--chrome <path>` when Chrome is not installed in a standard location.

Each page entry supplies live and target URLs plus either:

- `profilePath`, which reuses source selectors from
  `tools/importer/page-mappings.json`; or
- an explicit `blocks` list for pages outside the editorial importer.

The runner writes live and target screenshots, raw geometry and computed style
captures, `parity-report.json`, and `parity-summary.tsv`. Geometry is normalized
to the first mapped block so site chrome does not hide content deltas. Content
height, block height, normalized vertical position, and missing or unexpected
blocks determine the geometry result. Horizontal and computed-style differences
remain in the report as measured evidence, but do not gate the result because a
legacy portlet wrapper and an EDS block root are not equivalent horizontal boxes.

Every navigation must finish on the requested origin and pathname. Redirects to
another page fail before measurements are accepted. Ordered target captures also
fail when the rendered EDS block count differs from the configured mapping.

The completeness gate compares migrated main text with a fresh live content
region. The default floor is 30 percent, below the known-good Blue control of
33 percent and well above the observed partial Gold capture of about 5 percent.
An import performs the same independent live control and writes
`capture-completeness.json` into its work directory.

The fixture tests run without network access:

```sh
node --experimental-vm-modules --test test/parity-harness.test.mjs
```

They prove that complete captures pass and a partial page produces missing
blocks, a large content-height delta, and a failed text control instead of a
false zero.

## Issue 42 backfill

The recorded backfill is committed in
`tools/parity/results/issue-42/`. Screenshots and raw browser captures are under
`.mossy/parity/42/backfill/`.

| Page | Text ratio at 375 / 900 / 1440 | Vertical geometry result |
| --- | --- | --- |
| Homepage | 62.7% / 65.6% / 66.6% | Failed at 375 and 900; passed at 1440 |
| Baggage information | 39.4% / 39.4% / 38.9% | Failed at all widths |
| Seats | 31.4% / 31.4% / 37.7% | Failed at all widths |
| Blue benefits | 39.2% / 39.2% / 42.4% | Passed at all widths |

All twelve completeness controls passed. The nonzero homepage, baggage, and
seats geometry is a backfill finding, so the command exits nonzero rather than
turning it into a false parity claim. Blue has zero content-height, block-height,
and normalized-position delta at all three widths.

Baggage information and seats are currently published at the legacy migration
paths `/baggage-information` and `/seats`. Their canonical `/en-gb/` production
paths return 404, so this backfill records the current root outputs as targets.
Relocating those documents remains separate content work.
