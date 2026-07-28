#!/usr/bin/env node
/* eslint-env node */

import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ORIGIN = 'https://www.royalairmaroc.com';
const HOSTNAME = 'www.royalairmaroc.com';
const ROOT_SEEDS = [`${ORIGIN}/en/`, `${ORIGIN}/en-gb/`];
const SAMPLED_GENERATED_FAMILIES = new Set([
  'destination-landing',
  'origin-landing',
  'route-detail',
]);
const PAGE_ASSET_PATTERN = /\.(?:avif|bmp|css|csv|docx?|eot|gif|ico|jpe?g|js|json|map|mp3|mp4|pdf|png|pptx?|svg|tiff?|ttf|webp|woff2?|xlsx?|xml|zip)$/i;
const LINK_PATTERN = /<(?:a|area)\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_USER_AGENT = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  'AppleWebKit/537.36 (KHTML, like Gecko)',
  'Chrome/120.0.0.0 Safari/537.36',
].join(' ');

const KNOWN_CORRECTED_EDITORIAL_PATHS = [
  '/en-gb/royal-air-maroc-app',
  '/en-gb/help-support',
  '/en-gb/long-haul-business',
  '/en-gb/children-and-pregnancy/babies',
  '/en-gb/experience/dining-on-board/business',
  '/en-gb/long-haul-economy',
  '/en-gb/entertainment/long-haul',
  '/en-gb/safar-flyer/award-tickets',
  '/en-gb/access-to-lounge-areas',
  '/en-gb/oneworld/global-network',
  '/en-gb/login',
  '/en-gb/preparing-your-trip',
];

function compareStrings(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

const compareSeedUrls = (a, b) => {
  const rank = (value) => (new URL(value).pathname.startsWith('/en/') ? 0 : 1);
  return rank(a) - rank(b) || compareStrings(a, b);
};

export class RateLimitError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'RateLimitError';
    this.details = details;
  }
}

function createCrawlStalledError(message, details = {}) {
  const error = new Error(message);
  error.name = 'CrawlStalledError';
  error.details = details;
  return error;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(
      Number.parseInt(code, 16),
    ));
}

function canonicalizeSameHost(
  value,
  baseUrl,
  requireEnglishScope,
  normalizeScopeRoots = true,
) {
  try {
    const url = new URL(value, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.hostname.toLowerCase() !== HOSTNAME) return null;

    url.protocol = 'https:';
    url.hostname = HOSTNAME;
    url.port = '';
    url.hash = '';
    url.search = '';

    let { pathname } = url;
    pathname = pathname.replace(/\/{2,}/g, '/');
    if (
      normalizeScopeRoots
      && (pathname === '/en' || pathname === '/en-gb')
    ) {
      pathname = `${pathname}/`;
    }

    const inEnglishScope = ['/en', '/en-gb'].includes(pathname)
      || pathname.startsWith('/en/')
      || pathname.startsWith('/en-gb/');
    if (requireEnglishScope && !inEnglishScope) return null;
    if (requireEnglishScope && PAGE_ASSET_PATTERN.test(pathname)) return null;

    if (
      pathname.length > 1
      && pathname.endsWith('/')
      && !['/en/', '/en-gb/'].includes(pathname)
    ) {
      pathname = pathname.slice(0, -1);
    }

    return `${ORIGIN}${pathname}`;
  } catch {
    return null;
  }
}

export function normalizeUrl(value, baseUrl = ORIGIN) {
  return canonicalizeSameHost(value, baseUrl, true);
}

function robotsPatternToRegex(pattern) {
  const anchored = pattern.endsWith('$');
  const source = (anchored ? pattern.slice(0, -1) : pattern)
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${source}${anchored ? '$' : ''}`);
}

export function createRobotsPolicy(robotsTxt) {
  const groups = [];
  let group = null;

  robotsTxt.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) return;

    const separator = line.indexOf(':');
    if (separator === -1) return;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'user-agent') {
      if (!group || group.directives.length > 0) {
        group = { agents: [], directives: [] };
        groups.push(group);
      }
      group.agents.push(value.toLowerCase());
    } else if (
      group
      && ['allow', 'disallow'].includes(field)
      && value
    ) {
      group.directives.push({
        allow: field === 'allow',
        length: value.length,
        pattern: value,
        regex: robotsPatternToRegex(value),
      });
    }
  });

  const directives = groups
    .filter(({ agents }) => agents.includes('*'))
    .flatMap((entry) => entry.directives);

  ['/web/', '/int/'].forEach((pattern) => {
    if (!directives.some((directive) => directive.pattern === pattern)) {
      directives.push({
        allow: false,
        length: pattern.length,
        pattern,
        regex: robotsPatternToRegex(pattern),
      });
    }
  });

  return {
    allows(value) {
      let url;
      try {
        url = new URL(value, ORIGIN);
      } catch {
        return false;
      }
      if (url.hostname.toLowerCase() !== HOSTNAME) return false;

      const target = `${url.pathname}${url.search}`;
      const matches = directives
        .filter(({ regex }) => regex.test(target))
        .sort((a, b) => b.length - a.length || Number(b.allow) - Number(a.allow));
      return matches.length === 0 || matches[0].allow;
    },
    directives: directives
      .map(({ allow, pattern }) => ({ allow, pattern }))
      .sort((a, b) => compareStrings(a.pattern, b.pattern)),
  };
}

export function extractLinks(html, baseUrl, robots) {
  const links = new Set();
  let match = LINK_PATTERN.exec(html);

  while (match) {
    const href = decodeHtmlEntities(match[1] || match[2] || match[3] || '').trim();
    const normalized = normalizeUrl(href, baseUrl);
    if (normalized && robots.allows(normalized)) links.add(normalized);
    match = LINK_PATTERN.exec(html);
  }

  LINK_PATTERN.lastIndex = 0;
  return [...links].sort(compareStrings);
}

function familyResult(name, countPattern) {
  return { name, countPattern };
}

export function buildFamilyClassifier(siteScope) {
  const exact = new Map();
  const patterns = [];

  (siteScope.templates || []).forEach((template) => {
    (template.urls || []).forEach((value) => {
      const normalized = normalizeUrl(value, ORIGIN);
      if (normalized) {
        exact.set(
          normalized,
          familyResult(
            template.name,
            `Exact membership in site-scope template "${template.name}" URLs`,
          ),
        );
      }
    });

    if (template.urlPattern) {
      patterns.push({
        family: familyResult(template.name, template.urlPattern),
        regex: new RegExp(template.urlPattern),
      });
    }
  });

  return (value) => {
    const normalized = normalizeUrl(value, ORIGIN);
    if (!normalized) {
      return familyResult(
        'outside-english-scope',
        'Final URL is not a canonical /en/ or lowercase /en-gb/ page URL',
      );
    }

    if (exact.has(normalized)) return exact.get(normalized);
    const generated = patterns.find(({ regex }) => regex.test(normalized));
    if (generated) {
      const { family } = generated;
      return family;
    }

    const { pathname } = new URL(normalized);
    if (/^\/en\/vols-pour-[^/]+$/.test(pathname)) {
      return familyResult(
        'destination-alias',
        '^https://www\\.royalairmaroc\\.com/en/vols-pour-[^/]+$',
      );
    }
    if (/^\/en\/vols-de-[^/]+-a-[^/]+$/.test(pathname)) {
      return familyResult(
        'route-alias',
        '^https://www\\.royalairmaroc\\.com/en/vols-de-[^/]+-a-[^/]+$',
      );
    }
    if (
      /^\/en\/flights-to-(?:africa|asia|europe|north-america|south-america)$/
        .test(pathname)
    ) {
      return familyResult(
        'regional-destination-landing',
        '^https://www\\.royalairmaroc\\.com/en/flights-to-'
          + '(africa|asia|europe|north-america|south-america)$',
      );
    }
    if (pathname.startsWith('/en-gb/')) {
      return familyResult(
        'editorial-unclassified',
        'Canonical pathname starts /en-gb/ and has no exact site-scope URL match',
      );
    }
    return familyResult(
      'english-static-unclassified',
      'Canonical pathname starts /en/ and matches no catalog URL or generated-family pattern',
    );
  };
}

function addSeed(seedMap, value, source) {
  const normalized = normalizeUrl(value, ORIGIN);
  if (!normalized) return;
  if (!seedMap.has(normalized)) seedMap.set(normalized, new Set());
  seedMap.get(normalized).add(source);
}

export function buildSeedEntries({
  additionalSeeds = [],
  sitemapUrls,
  siteScope,
}) {
  const seedMap = new Map();

  ROOT_SEEDS.forEach((url) => addSeed(seedMap, url, 'root'));
  sitemapUrls.forEach((url) => addSeed(seedMap, url, 'sitemap'));
  (siteScope.templates || []).forEach((template) => {
    (template.urls || []).forEach((url) => addSeed(seedMap, url, 'catalog'));
  });
  additionalSeeds.forEach((url) => addSeed(seedMap, url, 'known-correction'));

  return [...seedMap.entries()]
    .map(([url, sources]) => ({ url, sources: [...sources].sort(compareStrings) }))
    .sort((a, b) => compareSeedUrls(a.url, b.url));
}

function sampleEvenly(urls, sampleSize) {
  if (urls.length <= sampleSize) return [...urls];
  if (sampleSize === 1) return [urls[0]];

  const selected = new Set();
  for (let index = 0; index < sampleSize; index += 1) {
    const position = Math.round((index * (urls.length - 1)) / (sampleSize - 1));
    selected.add(urls[position]);
  }
  return [...selected];
}

export function buildCrawlPlan({
  additionalSeeds = [],
  generatedSampleSize,
  sitemapUrls,
  siteScope,
}) {
  const classify = buildFamilyClassifier(siteScope);
  const sitemapGroups = new Map();

  sitemapUrls.forEach((url) => {
    const { name } = classify(url);
    if (!sitemapGroups.has(name)) sitemapGroups.set(name, []);
    sitemapGroups.get(name).push(url);
  });

  const generatedSamples = {};
  const selectedSitemapUrls = [];
  const coverage = [...sitemapGroups.entries()]
    .sort(([a], [b]) => compareStrings(a, b))
    .map(([family, urls]) => {
      const sortedUrls = [...urls].sort(compareStrings);
      const sampled = SAMPLED_GENERATED_FAMILIES.has(family);
      const selected = sampled
        ? sampleEvenly(sortedUrls, generatedSampleSize)
        : sortedUrls;
      if (sampled) generatedSamples[family] = selected;
      selectedSitemapUrls.push(...selected);

      return {
        family,
        mode: sampled ? 'sampled' : 'enumerated',
        englishSitemapCount: sortedUrls.length,
        englishSitemapCountPattern: (
          `English sitemap URLs classified as "${family}"`
        ),
        crawlTargetCount: selected.length,
        crawlTargetCountPattern: sampled
          ? `Up to ${generatedSampleSize} evenly spaced URLs from the sorted `
            + `"${family}" English sitemap family, including both endpoints`
          : `Every English sitemap URL classified as "${family}"`,
      };
    });

  const seeds = buildSeedEntries({
    additionalSeeds,
    sitemapUrls: selectedSitemapUrls,
    siteScope,
  });

  return {
    coverage,
    generatedSampleSize,
    generatedSamples,
    sampledUrls: Object.values(generatedSamples).flat().sort(compareStrings),
    seeds,
  };
}

export function shouldCrawlUrl(url, {
  classify,
  sampledSet,
  sitemapSet,
}) {
  const normalized = normalizeUrl(url, ORIGIN);
  if (!normalized) return false;

  const { pathname } = new URL(normalized);
  if (pathname.startsWith('/en-gb/')) return true;
  if (!sitemapSet.has(normalized)) return true;

  const { name } = classify(normalized);
  if (!SAMPLED_GENERATED_FAMILIES.has(name)) return true;
  return sampledSet.has(normalized);
}

export function rebuildProgress(events) {
  const metadataEvents = events.filter(({ type }) => type === 'metadata');
  if (metadataEvents.length !== 1) {
    throw new Error(
      `Progress log must contain exactly one metadata event; found ${metadataEvents.length}`,
    );
  }

  const metadata = metadataEvents[0];
  const seen = new Set((metadata.seeds || []).map(({ url }) => url));
  const records = new Map();

  events.filter(({ type }) => type === 'page').forEach((event) => {
    if (records.has(event.url)) {
      throw new Error(`Progress log contains a duplicate page event: ${event.url}`);
    }
    records.set(event.url, event);
    (event.links || []).forEach((url) => seen.add(url));
  });

  const queue = [...seen]
    .filter((url) => !records.has(url))
    .sort(compareStrings);

  return {
    metadata,
    queue,
    records,
    seen,
  };
}

function isRateLimited(response) {
  return response.status === 429
    || response.status === 503
    || Boolean(response.headers.get('retry-after'));
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeout };
}

async function fetchWithRedirects(value, {
  fetchImpl,
  gate = async () => {},
  maxRedirects = 10,
  robots,
  timeoutMs,
  userAgent,
}) {
  let currentUrl = canonicalizeSameHost(value, ORIGIN, false, false);
  const redirects = [];
  let redirectCount = 0;

  if (!currentUrl) {
    throw new Error(`Refusing to fetch a URL outside ${HOSTNAME}: ${value}`);
  }

  // Redirects are followed manually so no request can escape the allowed host.
  // eslint-disable-next-line no-await-in-loop
  while (redirectCount <= maxRedirects) {
    if (robots && !robots.allows(currentUrl)) {
      return {
        blockedReason: 'robots',
        finalUrl: currentUrl,
        redirects,
        response: null,
      };
    }

    // eslint-disable-next-line no-await-in-loop
    await gate();
    const { controller, timeout } = createTimeoutSignal(timeoutMs);
    let response;

    try {
      // eslint-disable-next-line no-await-in-loop
      response = await fetchImpl(currentUrl, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': userAgent,
        },
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch (error) {
      const reason = error.name === 'AbortError'
        ? `timed out after ${timeoutMs}ms`
        : error.message;
      throw createCrawlStalledError(`Fetch stalled for ${currentUrl}: ${reason}`, {
        cause: error.name,
        url: currentUrl,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (isRateLimited(response)) {
      throw new RateLimitError(
        `Rate limiting detected at ${currentUrl}: HTTP ${response.status}`,
        {
          retryAfter: response.headers.get('retry-after'),
          status: response.status,
          url: currentUrl,
        },
      );
    }

    const location = response.headers.get('location');
    if (REDIRECT_STATUSES.has(response.status) && location) {
      const nextUrl = canonicalizeSameHost(location, currentUrl, false, false);
      if (!nextUrl) {
        return {
          blockedReason: 'offsite-redirect',
          finalUrl: new URL(location, currentUrl).href,
          redirects: [...redirects, {
            from: currentUrl,
            status: response.status,
            to: new URL(location, currentUrl).href,
          }],
          response,
        };
      }

      redirects.push({
        from: currentUrl,
        status: response.status,
        to: nextUrl,
      });
      currentUrl = nextUrl;
      redirectCount += 1;
    } else {
      return {
        blockedReason: null,
        finalUrl: canonicalizeSameHost(
          response.url || currentUrl,
          currentUrl,
          false,
          false,
        ),
        redirects,
        response,
      };
    }
  }

  throw createCrawlStalledError(
    `Redirect limit exceeded for ${value}`,
    { maxRedirects, url: value },
  );
}

export async function fetchPage(url, {
  classify,
  fetchImpl = fetch,
  gate,
  robots,
  timeoutMs,
  userAgent,
}) {
  const result = await fetchWithRedirects(url, {
    fetchImpl,
    gate,
    robots,
    timeoutMs,
    userAgent,
  });

  if (!result.response) {
    throw new Error(`Robots policy unexpectedly blocked queued URL: ${url}`);
  }

  const contentType = result.response.headers.get('content-type') || '';
  let links = [];
  if (contentType.toLowerCase().includes('text/html')) {
    let html;
    try {
      html = await result.response.text();
    } catch (error) {
      throw createCrawlStalledError(
        `Response body stalled for ${url}: ${error.message}`,
        { cause: error.name, url },
      );
    }
    links = extractLinks(html, result.finalUrl, robots);
  }

  return {
    type: 'page',
    url,
    status: result.response.status,
    finalUrl: result.finalUrl,
    family: classify(url).name,
    finalFamily: classify(result.finalUrl).name,
    contentType,
    redirects: result.redirects,
    ...(result.blockedReason ? { redirectBlocked: result.blockedReason } : {}),
    links,
  };
}

export function summarizeUnion({
  classify,
  coverage = [],
  records,
  sitemapUrls,
}) {
  const sitemapCounts = new Map();
  const sitemapSet = new Set(sitemapUrls);
  const unionCounts = new Map();
  const crawlRecordCounts = new Map();
  const patterns = new Map();

  sitemapUrls.forEach((url) => {
    const family = classify(url);
    sitemapCounts.set(family.name, (sitemapCounts.get(family.name) || 0) + 1);
    patterns.set(family.name, family.countPattern);
  });

  records.forEach((record, url) => {
    const family = classify(url);
    crawlRecordCounts.set(
      family.name,
      (crawlRecordCounts.get(family.name) || 0) + 1,
    );
    patterns.set(family.name, family.countPattern);
  });

  const unionUrls = new Set([...sitemapUrls, ...records.keys()]);
  unionUrls.forEach((url) => {
    const family = classify(url);
    unionCounts.set(family.name, (unionCounts.get(family.name) || 0) + 1);
    patterns.set(family.name, family.countPattern);
  });

  const coverageByFamily = new Map(coverage.map((entry) => [entry.family, entry]));
  const familyNames = [...new Set([
    ...sitemapCounts.keys(),
    ...unionCounts.keys(),
  ])].sort(compareStrings);

  const families = familyNames.map((family) => {
    const sitemapCount = sitemapCounts.get(family) || 0;
    const unionCount = unionCounts.get(family) || 0;
    return {
      family,
      crawlMode: coverageByFamily.get(family)?.mode || 'enumerated',
      crawlModePattern: coverageByFamily.has(family)
        ? `Mode declared by crawl plan for "${family}"`
        : 'Family discovered outside the English sitemap and therefore enumerated',
      crawlRecordCount: crawlRecordCounts.get(family) || 0,
      crawlRecordCountPattern: `Completed crawl records classified by: ${patterns.get(family)}`,
      sitemapCount,
      sitemapCountPattern: `Exact sitemap URLs classified by: ${patterns.get(family)}`,
      unionCount,
      unionCountPattern: `Unique union of English sitemap and crawl request URLs classified by: ${patterns.get(family)}`,
      delta: unionCount - sitemapCount,
      deltaPattern: 'unionCount - English sitemap count for this family',
      countPattern: patterns.get(family),
    };
  });

  return {
    sitemapCount: sitemapUrls.length,
    sitemapCountPattern: 'Unique canonical <loc> entries in the English /en/sitemap.xml only',
    unionCount: unionUrls.size,
    unionCountPattern: 'Unique canonical URL union of English sitemap <loc> entries and completed crawl request URLs',
    missingFromSitemapCount: [...unionUrls]
      .filter((url) => !sitemapSet.has(url)).length,
    missingFromSitemapCountPattern: 'Union URLs minus exact English sitemap URLs',
    families,
    changedFamilies: families
      .filter(({ delta }) => delta !== 0)
      .map(({ family }) => family),
  };
}

function createRequestGate(intervalMs) {
  let chain = Promise.resolve();
  let nextRequestAt = 0;

  return async () => {
    let release;
    const previous = chain;
    chain = new Promise((resolveGate) => {
      release = resolveGate;
    });
    await previous;

    const waitMs = Math.max(0, nextRequestAt - Date.now());
    if (waitMs > 0) {
      await new Promise((resolveWait) => {
        setTimeout(resolveWait, waitMs);
      });
    }
    nextRequestAt = Date.now() + intervalMs;
    release();
  };
}

function extractLocValues(xml) {
  const values = [];
  const pattern = /<loc\b[^>]*>\s*([\s\S]*?)\s*<\/loc>/gi;
  let match = pattern.exec(xml);

  while (match) {
    values.push(decodeHtmlEntities(match[1].trim()));
    match = pattern.exec(xml);
  }
  return values;
}

function extractSitemapUrls(xml) {
  const urls = new Set();
  extractLocValues(xml).forEach((value) => {
    const normalized = normalizeUrl(value, ORIGIN);
    if (normalized) urls.add(normalized);
  });
  return [...urls].sort(compareStrings);
}

async function fetchRequiredText(url, {
  fetchImpl,
  gate,
  label,
  robots,
  timeoutMs,
  userAgent,
}) {
  const result = await fetchWithRedirects(url, {
    fetchImpl,
    gate,
    robots,
    timeoutMs,
    userAgent,
  });
  if (!result.response || result.response.status !== 200) {
    throw createCrawlStalledError(
      `${label} returned HTTP ${result.response?.status ?? 'none'}`,
    );
  }
  return result.response.text();
}

async function fetchSiteSitemapFloor({
  concurrency,
  fetchImpl,
  gate,
  robots,
  timeoutMs,
  userAgent,
}) {
  const indexUrl = `${ORIGIN}/sitemap_index.xml`;
  const indexXml = await fetchRequiredText(indexUrl, {
    fetchImpl,
    gate,
    label: 'sitemap_index.xml',
    robots,
    timeoutMs,
    userAgent,
  });
  const localeSitemapUrls = [...new Set(extractLocValues(indexXml))]
    .filter((url) => canonicalizeSameHost(url, ORIGIN, false, false))
    .sort(compareStrings);
  const localeResults = [];

  for (let index = 0; index < localeSitemapUrls.length; index += concurrency) {
    const batch = localeSitemapUrls.slice(index, index + concurrency);
    // eslint-disable-next-line no-await-in-loop
    const results = await Promise.all(batch.map(async (url) => {
      const result = await fetchWithRedirects(url, {
        fetchImpl,
        gate,
        robots,
        timeoutMs,
        userAgent,
      });
      const status = result.response?.status ?? 0;
      const urlCount = status === 200
        ? extractLocValues(await result.response.text()).length
        : 0;
      return { status, url, urlCount };
    }));
    localeResults.push(...results);
  }

  const count = localeResults.reduce((sum, entry) => sum + entry.urlCount, 0);
  const successfulCount = localeResults.filter(({ status }) => status === 200).length;

  return {
    count,
    countPattern: 'Sum of <loc> entry counts returned by the locale sitemap URLs listed in sitemap_index.xml; non-200 sitemap responses contribute zero, so this is a site floor',
    localeSitemapCount: localeSitemapUrls.length,
    localeSitemapCountPattern: 'Unique <loc> entries in sitemap_index.xml that resolve to www.royalairmaroc.com',
    successfulLocaleSitemapCount: successfulCount,
    successfulLocaleSitemapCountPattern: 'Listed locale sitemap requests whose final status is HTTP 200',
  };
}

function readProgressLog(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const events = [];
  let validLength = 0;
  let offset = 0;

  lines.forEach((line, index) => {
    const lineLength = Buffer.byteLength(line) + (index < lines.length - 1 ? 1 : 0);
    if (line.trim()) {
      try {
        events.push(JSON.parse(line));
        validLength = offset + lineLength;
      } catch (error) {
        const isFinalPartialLine = index === lines.length - 1 && !content.endsWith('\n');
        if (!isFinalPartialLine) {
          throw new Error(
            `Invalid progress event at line ${index + 1}: ${error.message}`,
          );
        }
        process.stderr.write(
          `Discarding incomplete final progress line ${index + 1}; resume will retry it.\n`,
        );
      }
    } else {
      validLength = offset + lineLength;
    }
    offset += lineLength;
  });

  if (validLength < Buffer.byteLength(content)) {
    writeFileSync(filePath, content.slice(0, validLength));
  }
  return events;
}

function appendEvents(filePath, events) {
  appendFileSync(
    filePath,
    `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
  );
}

function hashFile(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function countSeedSources(seeds) {
  const counts = new Map();
  seeds.forEach(({ sources }) => {
    sources.forEach((source) => {
      counts.set(source, (counts.get(source) || 0) + 1);
    });
  });
  return [...counts.entries()]
    .sort(([a], [b]) => compareStrings(a, b))
    .map(([source, count]) => ({
      source,
      count,
      countPattern: `Unique seed URLs whose sources array contains "${source}"`,
    }));
}

async function initializeProgress({
  concurrency,
  fetchImpl,
  gate,
  generatedSampleSize,
  intervalMs,
  scopePath,
  statePath,
  timeoutMs,
  userAgent,
}) {
  const siteScope = JSON.parse(readFileSync(scopePath, 'utf8'));
  const robotsResult = await fetchWithRedirects(`${ORIGIN}/robots.txt`, {
    fetchImpl,
    gate,
    robots: null,
    timeoutMs,
    userAgent,
  });
  if (!robotsResult.response || robotsResult.response.status !== 200) {
    throw createCrawlStalledError(
      `robots.txt returned HTTP ${robotsResult.response?.status ?? 'none'}`,
    );
  }
  const robotsTxt = await robotsResult.response.text();
  const robots = createRobotsPolicy(robotsTxt);

  const siteSitemapFloor = await fetchSiteSitemapFloor({
    concurrency,
    fetchImpl,
    gate,
    robots,
    timeoutMs,
    userAgent,
  });

  const englishSitemapUrl = `${ORIGIN}/en/sitemap.xml`;
  const englishSitemapXml = await fetchRequiredText(englishSitemapUrl, {
    fetchImpl,
    gate,
    label: '/en/sitemap.xml',
    robots,
    timeoutMs,
    userAgent,
  });
  const sitemapUrls = extractSitemapUrls(englishSitemapXml);
  if (sitemapUrls.length === 0) {
    throw new Error('English sitemap contained no canonical in-scope URLs');
  }

  const additionalSeeds = KNOWN_CORRECTED_EDITORIAL_PATHS
    .map((pathname) => `${ORIGIN}${pathname}`);
  const crawlPlan = buildCrawlPlan({
    additionalSeeds,
    generatedSampleSize,
    sitemapUrls,
    siteScope,
  });
  const { seeds } = crawlPlan;
  const knownStrayUrls = (siteScope.templates || [])
    .filter(({ contentSet }) => contentSet === 'observed-non-sitemap-alias')
    .flatMap(({ urls = [] }) => urls)
    .map((url) => normalizeUrl(url, ORIGIN))
    .filter(Boolean)
    .sort(compareStrings);

  const metadata = {
    type: 'metadata',
    schemaVersion: 2,
    origin: ORIGIN,
    scopePrefixes: ['/en/', '/en-gb/'],
    requestPolicy: {
      concurrency,
      intervalMs,
      timeoutMs,
      userAgent,
    },
    robots: {
      url: `${ORIGIN}/robots.txt`,
      text: robotsTxt,
      directives: robots.directives,
    },
    siteSitemapFloor,
    englishSitemap: {
      label: 'English sitemap only',
      url: englishSitemapUrl,
      urls: sitemapUrls,
      count: sitemapUrls.length,
      countPattern: 'Unique canonical <loc> entries in /en/sitemap.xml only',
    },
    crawlPlan,
    siteScopePath: scopePath,
    siteScopeSha256: hashFile(scopePath),
    seeds,
    seedCount: seeds.length,
    seedCountPattern: 'Unique normalized union of roots, bounded English sitemap targets, catalog URLs and corrections',
    seedSources: countSeedSources(seeds),
    knownStrayUrls,
    knownStrayCount: knownStrayUrls.length,
    knownStrayCountPattern: 'Explicit URLs in observed-non-sitemap-alias catalog templates',
  };

  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(metadata)}\n`);
  return { metadata, siteScope };
}

function buildCatalogOutput({ metadata, records, siteScope }) {
  const classify = buildFamilyClassifier(siteScope);
  const summary = summarizeUnion({
    classify,
    coverage: metadata.crawlPlan.coverage,
    records,
    sitemapUrls: metadata.englishSitemap.urls,
  });
  const knownStraySet = new Set(metadata.knownStrayUrls);
  const foundKnownStrays = [...knownStraySet].filter((url) => records.has(url));
  const statusCounts = new Map();

  records.forEach(({ status }) => {
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  });

  return {
    schemaVersion: 1,
    site: ORIGIN,
    scopePrefixes: metadata.scopePrefixes,
    countRule: 'Every count is paired with the selector, set operation or classifier that produced it.',
    requestPolicy: metadata.requestPolicy,
    robots: {
      url: metadata.robots.url,
      directives: metadata.robots.directives,
    },
    siteSitemapFloor: metadata.siteSitemapFloor,
    englishSitemap: {
      label: metadata.englishSitemap.label,
      count: summary.sitemapCount,
      countPattern: summary.sitemapCountPattern,
    },
    seeds: {
      count: metadata.seedCount,
      countPattern: metadata.seedCountPattern,
      sources: metadata.seedSources,
    },
    crawlCoverage: {
      statement: 'The /en-gb/ tree and non-sitemap /en/ links are enumerated. Route-detail, destination-landing and origin-landing English sitemap families are sampled.',
      generatedSampleSize: metadata.crawlPlan.generatedSampleSize,
      generatedSampleSizePattern: 'Configured maximum evenly spaced sample per large generated English sitemap family',
      enumeratedFamilies: summary.families
        .filter(({ crawlMode }) => crawlMode === 'enumerated')
        .map(({ family }) => family),
      sampledFamilies: summary.families
        .filter(({ crawlMode }) => crawlMode === 'sampled')
        .map(({ family }) => family),
    },
    summary: {
      crawlRecordCount: records.size,
      crawlRecordCountPattern: 'Unique requested URLs with one completed crawl record under the bounded crawl plan',
      union: {
        count: summary.unionCount,
        countPattern: summary.unionCountPattern,
      },
      deltaAgainstEnglishSitemap: {
        count: summary.missingFromSitemapCount,
        countPattern: summary.missingFromSitemapCountPattern,
        scope: 'This is a delta against the English /en/sitemap.xml only, not against the 72-locale site floor.',
      },
      knownStrays: {
        expectedCount: knownStraySet.size,
        expectedCountPattern: metadata.knownStrayCountPattern,
        foundCount: foundKnownStrays.length,
        foundCountPattern: 'Known stray URLs with a completed union record',
        missingCount: knownStraySet.size - foundKnownStrays.length,
        missingCountPattern: 'expectedCount - foundCount',
      },
      statuses: [...statusCounts.entries()]
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([status, count]) => ({
          status,
          count,
          countPattern: `Completed crawl records where final status == ${status}`,
        })),
      families: summary.families.map((family) => ({
        family: family.family,
        crawlMode: family.crawlMode,
        crawlModePattern: family.crawlModePattern,
        crawlRecordCount: family.crawlRecordCount,
        crawlRecordCountPattern: family.crawlRecordCountPattern,
        englishSitemapCount: family.sitemapCount,
        englishSitemapCountPattern: family.sitemapCountPattern,
        unionCount: family.unionCount,
        unionCountPattern: family.unionCountPattern,
        deltaAgainstEnglishSitemap: family.delta,
        deltaAgainstEnglishSitemapPattern: family.deltaPattern,
        familyPattern: family.countPattern,
      })),
      changedFamilies: summary.changedFamilies,
      changedFamilyCount: summary.changedFamilies.length,
      changedFamilyCountPattern: 'Family rows where union count minus English sitemap count is nonzero',
    },
    records: [...records.values()]
      .sort((a, b) => compareStrings(a.url, b.url))
      .map(({
        links,
        type,
        ...record
      }) => record),
  };
}

function writeJsonAtomic(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporaryPath, filePath);
}

function updateForbiddenStreak(results, initialStreak) {
  let streak = initialStreak;
  results.forEach(({ status }) => {
    streak = status === 403 ? streak + 1 : 0;
  });
  return streak;
}

async function runCrawl(options) {
  const scopePath = resolve(options.scopePath);
  const statePath = resolve(options.statePath);
  const outputPath = resolve(options.outputPath);
  const gate = createRequestGate(options.intervalMs);
  let initialized;

  if (!existsSync(statePath)) {
    initialized = await initializeProgress({
      concurrency: options.concurrency,
      fetchImpl: fetch,
      gate,
      generatedSampleSize: options.generatedSampleSize,
      intervalMs: options.intervalMs,
      scopePath,
      statePath,
      timeoutMs: options.timeoutMs,
      userAgent: options.userAgent,
    });
  }

  const events = readProgressLog(statePath);
  const progress = rebuildProgress(events);
  const siteScope = initialized?.siteScope
    || JSON.parse(readFileSync(scopePath, 'utf8'));

  if (hashFile(scopePath) !== progress.metadata.siteScopeSha256) {
    throw new Error(
      'catalog/site-scope.json changed after the crawl started; reset the state explicitly',
    );
  }

  const classify = buildFamilyClassifier(siteScope);
  const robots = createRobotsPolicy(progress.metadata.robots.text);
  const sitemapSet = new Set(progress.metadata.englishSitemap.urls);
  const sampledSet = new Set(progress.metadata.crawlPlan.sampledUrls);
  let processedThisRun = 0;
  let consecutiveForbidden = 0;
  let stopping = false;

  const requestStop = () => {
    stopping = true;
  };
  process.once('SIGINT', requestStop);
  process.once('SIGTERM', requestStop);

  try {
    // Batches make request order and appended progress deterministic.
    // eslint-disable-next-line no-await-in-loop
    while (
      progress.queue.length > 0
      && processedThisRun < options.maxPages
      && !stopping
    ) {
      const remaining = options.maxPages - processedThisRun;
      const batchSize = Math.min(options.concurrency, remaining);
      const batch = progress.queue.splice(0, batchSize);

      // eslint-disable-next-line no-await-in-loop
      const results = await Promise.all(batch.map((url) => fetchPage(url, {
        classify,
        fetchImpl: fetch,
        gate,
        robots,
        timeoutMs: options.timeoutMs,
        userAgent: options.userAgent,
      })));
      results.sort((a, b) => compareStrings(a.url, b.url));

      consecutiveForbidden = updateForbiddenStreak(results, consecutiveForbidden);
      if (consecutiveForbidden >= 5) {
        throw new RateLimitError(
          'Five consecutive page requests returned HTTP 403; stopping before continuing',
        );
      }

      const compactEvents = results.map((record) => {
        const normalizedFinal = normalizeUrl(record.finalUrl, ORIGIN);
        const discovered = normalizedFinal && normalizedFinal !== record.url
          ? [...record.links, normalizedFinal]
          : record.links;
        const newLinks = [...new Set(discovered)]
          .filter((url) => shouldCrawlUrl(url, {
            classify,
            sampledSet,
            sitemapSet,
          }))
          .filter((url) => !progress.seen.has(url))
          .sort(compareStrings);
        newLinks.forEach((url) => progress.seen.add(url));
        return { ...record, links: newLinks };
      });

      appendEvents(statePath, compactEvents);
      compactEvents.forEach((event) => {
        progress.records.set(event.url, event);
        event.links.forEach((url) => progress.queue.push(url));
      });
      progress.queue.sort(compareStrings);
      processedThisRun += compactEvents.length;

      if (
        progress.records.size % options.progressEvery < compactEvents.length
        || progress.queue.length === 0
      ) {
        process.stdout.write(
          `${[
            'pattern=page events',
            `processed=${progress.records.size}`,
            'pattern=unique seeds plus discovered links minus page events',
            `pending=${progress.queue.length}`,
            'pattern=unique seeds plus discovered links',
            `seen=${progress.seen.size}`,
          ].join('; ')}\n`,
        );
      }
    }
  } finally {
    process.removeListener('SIGINT', requestStop);
    process.removeListener('SIGTERM', requestStop);
  }

  if (progress.queue.length > 0) {
    process.stdout.write(
      `${[
        'Crawl paused with resumable state.',
        'pattern=page events',
        `processed=${progress.records.size}`,
        'pattern=unique seeds plus discovered links minus page events',
        `pending=${progress.queue.length}`,
      ].join(' ')}\n`,
    );
    return 2;
  }

  const output = buildCatalogOutput({
    metadata: progress.metadata,
    records: progress.records,
    siteScope,
  });
  writeJsonAtomic(outputPath, output);
  process.stdout.write(
    `${[
      'Crawl frontier exhausted.',
      `pattern=${output.summary.union.countPattern}`,
      `union=${output.summary.union.count}`,
      `pattern=${output.summary.deltaAgainstEnglishSitemap.countPattern}`,
      `outside_english_sitemap=${output.summary.deltaAgainstEnglishSitemap.count}`,
      `changed_families=${output.summary.changedFamilies.join(',') || 'none'}`,
    ].join(' ')}\n`,
  );
  return 0;
}

function parseInteger(value, option, minimum = 1) {
  if (!/^\d+$/.test(value || '') || Number(value) < minimum) {
    throw new Error(`${option} requires an integer >= ${minimum}`);
  }
  return Number(value);
}

function parseArgs(rawArgs) {
  const options = {
    concurrency: 3,
    generatedSampleSize: 30,
    intervalMs: 200,
    maxPages: Number.POSITIVE_INFINITY,
    outputPath: 'catalog/url-space.json',
    progressEvery: 100,
    reset: false,
    scopePath: 'catalog/site-scope.json',
    statePath: 'catalog/.url-crawl-progress.ndjson',
    timeoutMs: 30000,
    userAgent: DEFAULT_USER_AGENT,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const option = rawArgs[index];
    const value = rawArgs[index + 1];
    if (option === '--concurrency') {
      options.concurrency = parseInteger(value, option);
      index += 1;
    } else if (option === '--generated-sample') {
      options.generatedSampleSize = parseInteger(value, option);
      index += 1;
    } else if (option === '--interval') {
      options.intervalMs = parseInteger(value, option);
      index += 1;
    } else if (option === '--max-pages') {
      options.maxPages = parseInteger(value, option);
      index += 1;
    } else if (option === '--output') {
      options.outputPath = value;
      index += 1;
    } else if (option === '--progress-every') {
      options.progressEvery = parseInteger(value, option);
      index += 1;
    } else if (option === '--scope') {
      options.scopePath = value;
      index += 1;
    } else if (option === '--state') {
      options.statePath = value;
      index += 1;
    } else if (option === '--timeout') {
      options.timeoutMs = parseInteger(value, option);
      index += 1;
    } else if (option === '--reset') {
      options.reset = true;
    } else if (option === '--help' || option === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${option}`);
    }
  }
  return options;
}

function printHelp() {
  process.stdout.write(`
Usage: node scripts/crawl-url-space.mjs [options]

Options:
  --concurrency N     Concurrent fetches per deterministic batch (default: 3)
  --generated-sample N
                      Even sample per large generated family (default: 30)
  --interval MS       Minimum gap between request starts (default: 200)
  --max-pages N       Pause after N new page records; rerun to resume
  --output PATH       Final union catalog (default: catalog/url-space.json)
  --progress-every N  Print progress every N completed records (default: 100)
  --scope PATH        Site template catalog (default: catalog/site-scope.json)
  --state PATH        Append-only resume log (default: catalog/.url-crawl-progress.ndjson)
  --timeout MS        Per-request timeout (default: 30000)
  --reset             Remove only the configured state and output before starting
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (options.reset) {
    [options.statePath, options.outputPath, `${options.outputPath}.tmp`]
      .map((value) => resolve(value))
      .forEach((filePath) => {
        if (existsSync(filePath)) rmSync(filePath);
      });
  }

  const exitCode = await runCrawl(options);
  process.exitCode = exitCode;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : '';

if (invokedPath && import.meta.url === invokedPath) {
  main().catch((error) => {
    const details = error.details ? ` ${JSON.stringify(error.details)}` : '';
    process.stderr.write(`${error.name}: ${error.message}${details}\n`);
    process.exitCode = error instanceof RateLimitError ? 3 : 1;
  });
}
