# Editorial import pipeline

This pipeline imports the 79 editorial pages assigned by
`catalog/site-scope.json`. The catalog remains the source of truth for the seven
templates and all URL assignments. The pipeline rejects `/en-GB/` and
`/en_gb/`; editorial input and output paths use lowercase `/en-gb/`.

## Build and validate the infrastructure

```sh
node tools/importer/build-page-templates.mjs
node tools/importer/validate-infrastructure.mjs
```

`page-templates.json` is generated from the committed catalog. Do not maintain a
second URL list by hand. `page-mappings.json` holds source selectors and authored
row models. The shared `labeled-block` parser applies those mappings, so a new
page profile needs JSON mapping data, not new parser code.

## Import one page

Run the full four phase loop:

```sh
node tools/importer/import-editorial.mjs \
  --url https://www.royalairmaroc.com/en-gb/seats \
  --template standard-article \
  --work-dir migration-work/seats \
  --output content/en-gb/seats.plain.html
```

The command performs:

1. Analysis: captures the rendered live DOM, screenshot, metadata, and images.
2. Mapping: writes section, authoring, visual tree, and per-block source context.
3. Infrastructure selection: validates the URL against the catalog template and
   uses the matching template import script, parser, and transformers.
4. Content import: writes DA-compatible plain HTML and an import report with
   `handEdits: 0`.

Images are downloaded during analysis. Content import copies them to an
`images/<page>/` directory beside the output file and writes relative authored
image references. Generated content therefore does not hotlink the legacy site.
Upload those binaries through the DA media flow when importing the generated
document into DA.

Run an individual phase with `--phase analyze`, `--phase map`, or
`--phase import`. Later phases reuse `cleaned.html` from the same work directory.
Set `CHROME_PATH` only when Chrome is not installed in a standard location.

## Add the next page

1. Run the analysis phase against the exact catalog URL.
2. Add a profile to `page-mappings.json` using existing block variants first.
3. Use labeled rows for every repeated authored item.
4. Run `build-page-templates.mjs` and `validate-infrastructure.mjs`.
5. Run the full import and preview the generated plain HTML locally.

No JavaScript change is needed for the next page. New source shapes are expressed
with selectors and cell kinds in `page-mappings.json`. A genuinely new visual
variant still follows the normal content modeling and block development process
before it is added to the mapping.

## Link policy

Only links explicitly listed in a profile's `editorialPaths` are normalized from
legacy `/en/` or `/en-GB/` forms to `/en-gb/`. Absolute links to another locale
remain absolute. The baggage hub's four `ma-en` support links are deliberate
English Morocco locale links on live, and their targets currently exist only on
the old stack. They remain unchanged until those targets have migrated URLs and
an explicit mapping rule.

## Scratch proof

Use a scratch output under `drafts/` for parity work. This never uploads or
publishes a DA document and cannot overwrite an existing page:

```sh
node tools/importer/import-editorial.mjs \
  --url https://www.royalairmaroc.com/en-gb/baggage-information \
  --work-dir .mossy/parity/12/imports/baggage-information \
  --output drafts/imported-baggage-information.plain.html
```
