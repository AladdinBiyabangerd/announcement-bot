import { config } from "../config.js";
import { fetchHtml } from "./http.js";
import { dedupeListings } from "./listing.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchMergedCategoryListings({
  categories,
  buildPageUrl,
  parse,
  maxPerCategory = config.scraper.maxResultsPerSource,
}) {
  const batches = [];
  let lastError = null;
  for (const category of categories) {
    try {
      batches.push(
        await fetchPaginatedListings({
          buildPageUrl: (page) => buildPageUrl(page, category),
          parse,
          max: maxPerCategory,
        }),
      );
    } catch (err) {
      lastError = err;
      console.warn(`Kateqoriya oxunmadı: ${String(category)}`, err?.message || err);
    }
  }
  const merged = dedupeListings(batches.flat());
  if (!merged.length && lastError) {
    throw lastError;
  }
  return merged;
}

export async function fetchPaginatedListings({
  buildPageUrl,
  parse,
  max = config.scraper.maxResultsPerSource,
  maxPages = config.scraper.maxPagesPerSource,
  delayMs = config.scraper.requestDelayMs,
}) {
  const collected = [];
  for (let page = 1; page <= maxPages && collected.length < max; page += 1) {
    const url = buildPageUrl(page);
    let html;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      if (page === 1) {
        throw err;
      }
      console.warn(`Səhifə oxunmadı, dayanır: page=${page} url=${url}`, err?.message || err);
      break;
    }
    const items = parse(html) || [];
    if (items.length === 0) {
      break;
    }
    const before = collected.length;
    collected.push(...items);
    const unique = dedupeListings(collected);
    collected.length = 0;
    collected.push(...unique);
    if (collected.length === before) {
      break;
    }
    if (page < maxPages && collected.length < max) {
      await sleep(delayMs);
    }
  }
  return collected.slice(0, max);
}
