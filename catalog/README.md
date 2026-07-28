# Royal Air Maroc site scope

`site-scope.json` is the migration template catalog for issue #10. It keeps the
live content sets separate:

- `/en-gb/` contains authored editorial pages served from DA documents.
- `/en/` contains authored English landing pages plus generated flight-catalog
  pages served from narrow Bring Your Own Markup (BYOM) mounts.

Neither prefix is normalized to the other. A slug is cataloged only under the
prefix where live serves it.

## Reconciliation

| Scope | Count | Pattern |
| --- | ---: | --- |
| Locale sitemaps | 72 | `<loc>` entries in `sitemap_index.xml` matching a locale sitemap URL |
| Base languages | 9 | Distinct base token before an optional underscore in the 72 locale sitemap path segments |
| Editorial navigation pages | 79 | Unique `href="/en-GB/[^"]+"` values in the `shoot.mjs`-rendered header DOM, with only the prefix case corrected to `/en-gb/` |
| English sitemap URLs | 37,156 | `<loc>` entries in `https://www.royalairmaroc.com/en/sitemap.xml` |
| Route detail pages | 36,577 | `^https://www\.royalairmaroc\.com/en/flights-from-[^/]+-to-[^/]+$` |
| Destination landing pages | 263 | `^https://www\.royalairmaroc\.com/en/flights-to-[^/]+$` |
| Origin landing pages | 262 | `^https://www\.royalairmaroc\.com/en/flights-from-(?!.*-to-)[^/]+$` |
| Sitemap index pages | 42 | `^https://www\.royalairmaroc\.com/en/sitemap/[^/]+/page-[0-9]+$` |
| Static English pages excluding `/en/` | 11 | English sitemap entries remaining after the generated-family patterns and `/en/` are excluded |
| English homepage | 1 | `^https://www\.royalairmaroc\.com/en/$` |
| Observed non-sitemap English aliases | 65 | Unique rendered chrome hrefs with an `/en/` path minus exact English sitemap `<loc>` entries |

The alias figure is deliberately labeled non-exhaustive in the catalog. Its
pattern measures chrome-linked paths only: 59 `vols-pour-*` destination aliases,
five regional `flights-to-*` pages, and one `vols-de-*-a-*` route alias.

## Delivery mechanisms

The catalog has 19 template records, counted by `.templates | length`:

- Seven `/en-gb/` templates assign all 79 editorial URLs to DA documents.
- Five `/en/` DA templates cover the 12 exact static paths, counted from their
  explicit `urls` arrays.
- Four canonical `/en/` BYOM templates cover 37,144 sitemap URLs, counted as
  `36,577 + 263 + 262 + 42` from the four exact family patterns.
- Three `/en/` BYOM alias templates cover the 65 observed chrome-linked paths
  outside the sitemap, counted from their explicit `urls` arrays.

The generated families use narrow mount prefixes. They must appear before the
DA root mount because mount matching takes the first prefix hit.

## Rendered source states

Every one of the 79 editorial targets was rendered with
`.mossy/tools/shoot.mjs --url URL --dom` before assignment:

- 60 render page-specific content, counted when the title is not a 404 title and
  `#content` does not carry `home-layout`.
- Seven render the homepage shell, counted when a non-home URL has
  `#content.home-layout`.
- 12 render the 404 shell, counted when the rendered `<title>` starts with
  `404 Page`.

The latter two groups remain explicit templates instead of being hidden inside
the valid article groups. Their target delivery mechanism is still a DA
document, while their live source state records the content gap.
