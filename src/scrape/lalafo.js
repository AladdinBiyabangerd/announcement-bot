import * as cheerio from "cheerio";
import { SOURCES } from "../data/sources.js";
import { listing, dedupeListings } from "./listing.js";
import { fetchPaginatedListings } from "./paginate.js";
import { fetchJson } from "./http.js";
import {
  firstNonBlank,
  parsePriceFromText,
  parseRooms,
  parseSot,
  parseSqm,
} from "./textParser.js";
import { config } from "../config.js";

const AZ_COUNTRY_ID = 13;

const CATEGORIES = {
  HOUSE: [
    { id: 2030, path: "/azerbaijan/doma-i-dachi" },
    { id: 5951, path: "/azerbaijan/bag-evleri" },
  ],
  LAND: [{ id: 2037, path: "/azerbaijan/zemelnye-uchastki" }],
};

function categoriesFor(subscription) {
  return subscription.propertyType === "LAND" ? CATEGORIES.LAND : CATEGORIES.HOUSE;
}

export function buildSearchUrl(subscription, page = 1, path = null) {
  const category = path || categoriesFor(subscription)[0].path;
  const url = `${SOURCES.LALAFO_AZ.baseUrl}${category}`;
  return page > 1 ? `${url}?page=${page}` : url;
}

function imageUrl(ad) {
  const images = Array.isArray(ad.images) ? ad.images : [];
  const main = images.find((img) => img?.is_main) || images[0];
  return firstNonBlank(main?.original_url, main?.thumbnail_url, ad.image);
}

function toListing(ad) {
  if (!ad?.id) {
    return null;
  }
  if (ad.country_id != null && Number(ad.country_id) !== AZ_COUNTRY_ID) {
    return null;
  }
  const title = ad.title || "";
  const path = ad.url || "";
  const href = path.startsWith("http") ? path : `${SOURCES.LALAFO_AZ.baseUrl}${path}`;
  const city = typeof ad.city === "string" ? ad.city : ad.city?.name || null;
  return listing({
    source: SOURCES.LALAFO_AZ.name,
    sourceLabel: SOURCES.LALAFO_AZ.label,
    externalId: String(ad.id),
    title,
    price: typeof ad.price === "number" ? ad.price : parsePriceFromText(String(ad.price || "")),
    currency: ad.currency || "AZN",
    region: city,
    url: href,
    imageUrl: imageUrl(ad),
    publishedAt: ad.updated_time ? new Date(ad.updated_time * 1000).toISOString() : null,
    areaSqm: parseSqm([], title),
    landSot: parseSot([], title),
    roomCount: parseRooms([], title),
    country: "AZ",
  });
}

function walkFeedItems(root) {
  const items = root?.props?.initialState?.listing?.listingFeed?.data?.items;
  if (Array.isArray(items) && items.length) {
    return items;
  }
  const nested = root?.props?.pageProps?.listingFeed?.data?.items;
  if (Array.isArray(nested) && nested.length) {
    return nested;
  }
  return [];
}

function parseNextData(html) {
  const $ = cheerio.load(html);
  const raw = $("#__NEXT_DATA__").text() || $("#__NEXT_DATA__").html();
  if (!raw) {
    return null;
  }
  try {
    return walkFeedItems(JSON.parse(raw)).map(toListing).filter(Boolean);
  } catch {
    return null;
  }
}

function parseHtmlCards(html) {
  const $ = cheerio.load(html);
  const listings = [];
  $("a.lf-ad-tile__link[href], a[href*='/ads/']").each((_, link) => {
    const el = $(link);
    const href = el.attr("href") || "";
    const match = href.match(/id-(\d+)/) || href.match(/-(\d+)(?:\/)?(?:\?|$)/);
    if (!match) {
      return;
    }
    const externalId = match[1];
    if (listings.some((row) => row.externalId === externalId)) {
      return;
    }
    const title = (el.attr("title") || el.text() || `Elan #${externalId}`).trim();
    const card = el.closest("article, li, div");
    listings.push(
      listing({
        source: SOURCES.LALAFO_AZ.name,
        sourceLabel: SOURCES.LALAFO_AZ.label,
        externalId,
        title,
        price: parsePriceFromText(card.find("[class*='price']").first().text() || el.text()),
        currency: "AZN",
        region: null,
        url: href.startsWith("http") ? href : `${SOURCES.LALAFO_AZ.baseUrl}${href}`,
        imageUrl: el.find("img").attr("src") || null,
        areaSqm: parseSqm([], title),
        landSot: parseSot([], title),
        roomCount: parseRooms([], title),
        country: "AZ",
      }),
    );
  });
  return listings;
}

export function parse(html) {
  const fromJson = parseNextData(html);
  if (fromJson && fromJson.length) {
    return fromJson;
  }
  const fromHtml = parseHtmlCards(html);
  if (fromHtml.length) {
    return fromHtml;
  }
  return fromJson || [];
}

async function fetchApiCategory(categoryId, page) {
  const url = `${SOURCES.LALAFO_AZ.baseUrl}/api/search/v3/feed/search?category_id=${categoryId}&expand=url&page=${page}`;
  const payload = await fetchJson(url, {
    Accept: "application/json",
    language: "az_AZ",
    "Country-Id": String(AZ_COUNTRY_ID),
  });
  const items = payload?.items || payload?.data?.items || [];
  return items.map(toListing).filter(Boolean);
}

async function fetchApi(subscription) {
  const collected = [];
  for (const category of categoriesFor(subscription)) {
    for (let page = 1; page <= config.scraper.maxPagesPerSource; page += 1) {
      const items = await fetchApiCategory(category.id, page);
      if (!items.length) {
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
    }
  }
  return collected.slice(0, config.scraper.maxResultsPerSource);
}

export async function fetchListings(subscription) {
  const batches = [];
  let htmlFailed = null;
  for (const category of categoriesFor(subscription)) {
    try {
      batches.push(
        await fetchPaginatedListings({
          buildPageUrl: (page) => buildSearchUrl(subscription, page, category.path),
          parse,
          max: config.scraper.maxResultsPerSource,
        }),
      );
    } catch (err) {
      htmlFailed = err;
    }
  }
  const fromHtml = dedupeListings(batches.flat());
  if (fromHtml.length) {
    return fromHtml.slice(0, config.scraper.maxResultsPerSource);
  }
  try {
    return await fetchApi(subscription);
  } catch (err) {
    if (htmlFailed) {
      throw htmlFailed;
    }
    throw err;
  }
}
