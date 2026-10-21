import * as cheerio from "cheerio";
import { SOURCES } from "../data/sources.js";
import { TAP_LAND_MIN_SOT_PARAM, TAP_REGION_BY_BINA } from "./citySlugs.js";
import { listing } from "./listing.js";
import { fetchMergedCategoryListings } from "./paginate.js";
import { parseRooms, parseSot, parseSqm, parsePriceFromText, buildQuery } from "./textParser.js";

export function categoryPaths(subscription) {
  if (subscription.propertyType === "LAND") {
    return ["torpaq-sahesi"];
  }
  return ["menziller", "heyet-evleri", "bag-evleri"];
}

export function buildSearchUrl(subscription, page = 1, category = null) {
  const params = [];
  params.push(["q[price][]", subscription.minPrice ?? ""]);
  params.push(["q[price][]", subscription.maxPrice ?? ""]);
  params.push(["keywords_source", "typewritten"]);
  const region = TAP_REGION_BY_BINA[subscription.cityId];
  if (region) {
    params.push(["q[region_id]", region]);
  }
  if (subscription.propertyType === "LAND") {
    const key = `p[${TAP_LAND_MIN_SOT_PARAM}][]`;
    params.push([key, subscription.landSot ?? ""]);
    params.push([key, ""]);
  }
  if (page > 1) {
    params.push(["page", page]);
  }
  const path = category || categoryPaths(subscription)[0];
  return `${SOURCES.TAP_AZ.baseUrl}/elanlar/dasinmaz-emlak/${path}?${buildQuery(params)}`;
}

function toListing(ad) {
  const title = ad.title || "";
  const path = ad.path || ad.url || "";
  let publishedAt = null;
  if (ad.updatedAt) {
    const parsed = Date.parse(ad.updatedAt);
    publishedAt = Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  const href = path.startsWith("http") ? path : `${SOURCES.TAP_AZ.baseUrl}${path}`;
  return listing({
    source: SOURCES.TAP_AZ.name,
    sourceLabel: SOURCES.TAP_AZ.label,
    externalId: String(ad.legacyResourceId ?? ad.id ?? ""),
    title,
    price: typeof ad.price === "number" ? ad.price : parsePriceFromText(String(ad.price || "")),
    currency: "AZN",
    region: ad.region || ad.city || null,
    url: href,
    imageUrl: ad.photo && typeof ad.photo === "object" ? ad.photo.url || null : ad.imageUrl || null,
    publishedAt,
    areaSqm: parseSqm([], title),
    landSot: parseSot([], title),
    roomCount: parseRooms([], title),
    country: "AZ",
  });
}

function parseNextData(html) {
  const $ = cheerio.load(html);
  const nextData = $("#__NEXT_DATA__").text() || $("#__NEXT_DATA__").html();
  if (!nextData) {
    return null;
  }
  let root;
  try {
    root = JSON.parse(nextData);
  } catch {
    return null;
  }
  const apolloState = root?.props?.pageProps?.apolloState;
  if (apolloState && typeof apolloState === "object") {
    const listings = [];
    for (const [key, ad] of Object.entries(apolloState)) {
      if (!key.startsWith("Ad:") || !ad || ad.__typename !== "Ad") {
        continue;
      }
      listings.push(toListing(ad));
    }
    if (listings.length) {
      return listings;
    }
  }
  return [];
}

function parseHtmlCards(html) {
  const $ = cheerio.load(html);
  const listings = [];
  $("a.products-link[href], a[href*='/elanlar/dasinmaz-emlak/']").each((_, link) => {
    const el = $(link);
    const href = el.attr("href") || "";
    const match = href.match(/\/(\d+)(?:\/)?(?:\?|$)/);
    if (!match) {
      return;
    }
    const externalId = match[1];
    if (listings.some((row) => row.externalId === externalId)) {
      return;
    }
    const title =
      el.attr("title") ||
      el.find("img[alt]").attr("alt") ||
      el.find(".products-name, .product-title").first().text() ||
      `Elan #${externalId}`;
    const card = el.closest("div, li, article");
    const priceText = card.find(".products-price, .price").first().text() || el.text();
    listings.push(
      listing({
        source: SOURCES.TAP_AZ.name,
        sourceLabel: SOURCES.TAP_AZ.label,
        externalId,
        title: title.trim(),
        price: parsePriceFromText(priceText),
        currency: "AZN",
        region: card.find(".products-created, .location").first().text().trim() || null,
        url: href.startsWith("http") ? href : `${SOURCES.TAP_AZ.baseUrl}${href}`,
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
  if (fromJson === null) {
    throw new Error("tap.az: __NEXT_DATA__ tapılmadı və HTML kartlar oxunmadı");
  }
  return [];
}

export async function fetchListings(subscription) {
  return fetchMergedCategoryListings({
    categories: categoryPaths(subscription),
    buildPageUrl: (page, category) => buildSearchUrl(subscription, page, category),
    parse,
  });
}
