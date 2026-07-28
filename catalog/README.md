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

## Crawled URL union

`url-space.json` expands the catalog with a resumable, bounded crawl. The site
floor is 320,718 URLs, counted as the sum of `<loc>` entries returned by the 72
locale sitemap URLs listed in `sitemap_index.xml`. Of those 72 listed URLs, 69
returned HTTP 200; non-200 responses contribute zero, which is why the result is
a floor rather than a complete site total.

The English union contains 37,572 URLs, counted as the unique canonical union of
the 37,156 exact `<loc>` entries in `/en/sitemap.xml` and completed crawl request
URLs. Its 416-URL delta is the set difference between that union and the English
sitemap only; it is not a delta against the 72-locale site floor. All 65 known
strays were found, counted by intersecting completed crawl request URLs with the
explicit URLs in the three observed non-sitemap alias templates.

The crawl exhaustively enumerates the `/en-gb/` tree and `/en/` URLs absent from
the English sitemap. It samples the three large generated families rather than
enumerating sitemap-known URLs:

| Sampled family | English sitemap population | Crawl sample | Population pattern |
| --- | ---: | ---: | --- |
| Route detail | 36,577 | 30 | `^https://www\.royalairmaroc\.com/en/flights-from-[^/]+-to-[^/]+$` |
| Destination landing | 263 | 30 | `^https://www\.royalairmaroc\.com/en/flights-to-[^/]+$` |
| Origin landing | 262 | 30 | `^https://www\.royalairmaroc\.com/en/flights-from-(?!.*-to-)[^/]+$` |

Each sample is at most 30 evenly spaced URLs from the sorted family, including
both endpoints. Every other family in `crawlCoverage.enumeratedFamilies` is
enumerated. The crawl wrote 560 completed records, counted as unique requested
URLs with one page event under this bounded plan.

These are the only families whose union is larger than the English sitemap.
Each row is counted with the family classifier shown; delta is union count minus
English sitemap count for that family.

| Family | English sitemap | Union | Delta | Classifier |
| --- | ---: | ---: | ---: | --- |
| Collection listing | 0 | 11 | 11 | Exact `collection-listing` catalog URL membership |
| Destination alias | 0 | 59 | 59 | Exact `destination-alias` catalog URL membership |
| Editorial unclassified | 0 | 92 | 92 | `/en-gb/` path with no exact catalog URL match |
| English static unclassified | 0 | 180 | 180 | `/en/` path matching no catalog URL or generated-family pattern |
| Feature story | 0 | 15 | 15 | Exact `feature-story` catalog URL membership |
| Interactive service | 0 | 14 | 14 | Exact `interactive-service` catalog URL membership |
| Live not found | 0 | 12 | 12 | Exact `live-not-found` catalog URL membership |
| Navigation landing alias | 0 | 7 | 7 | Exact `navigation-landing-alias` catalog URL membership |
| Regional destination landing | 0 | 5 | 5 | Exact `regional-destination-landing` catalog URL membership |
| Route alias | 0 | 1 | 1 | Exact `route-alias` catalog URL membership |
| Standard article | 0 | 10 | 10 | Exact `standard-article` catalog URL membership |
| Structured reference | 0 | 10 | 10 | Exact `structured-reference` catalog URL membership |

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
