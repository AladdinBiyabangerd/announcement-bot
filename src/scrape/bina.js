import * as cheerio from "cheerio";
import { SOURCES } from "../data/sources.js";
import { binaCitySlug } from "./citySlugs.js";
import { listing } from "./listing.js";
import { fetchPaginatedListings } from "./paginate.js";
import { firstNonBlank, parsePriceFromText, parseSot, buildQuery } from "./textParser.js";
import { config } from "../config.js";

const ROOM_PATTERN = /(\d+)\s*\+?\s*otaq/iu;
const SQM_PATTERN = /(\d+(?:[.,]\d+)?)\s*m\s*(?:²|2)/iu;

function parseRooms(params, title) {
  for (const param of params) {
    const match = ROOM_PATTERN.exec(param.toLowerCase());
    if (match) {
      return Number(match[1]);
    }
  }
  const match = ROOM_PATTERN.exec(title.toLowerCase());
  return match ? Number(match[1]) : null;
}

function parseSqm(params, title) {
  for (const param of params) {
    const lower = param.toLowerCase();
    const match = SQM_PATTERN.exec(lower);
    if (match && !lower.includes("sot")) {
      return Math.round(Number(match[1].replace(",", ".")));
    }
  }
  const lowerTitle = title.toLowerCase();
  const match = SQM_PATTERN.exec(lowerTitle);
  if (match && !lowerTitle.includes("sot")) {
    return Math.round(Number(match[1].replace(",", ".")));
  }
  return null;
}

function categorySlug(subscription) {
  return subscription.propertyType === "LAND" ? "torpaq" : "heyet-evleri";
}

function applyFilters(params, subscription) {
  if (!subscription.propertyType) {
    if (subscription.minPrice != null) {
      params.push(["price_from", subscription.minPrice]);
    }
    if (subscription.maxPrice != null) {
      params.push(["price_to", subscription.maxPrice]);
    }
    return;
  }
  if (subscription.cityId != null) {
    params.push(["city_id", subscription.cityId]);
  }
  if (subscription.propertyType === "LAND" && subscription.landSot != null) {
    params.push(["area_from", subscription.landSot]);
  }
  if (subscription.propertyType === "HOUSE" && subscription.areaSqm != null) {
    params.push(["area_from", subscription.areaSqm]);
    params.push(["area_to", subscription.areaSqm]);
  }
  if (subscription.roomCount != null) {
    params.push(["room_ids[]", subscription.roomCount >= 5 ? "5+" : String(subscription.roomCount)]);
  }
  if (subscription.minPrice != null) {
    params.push(["price_from", subscription.minPrice]);
  }
  if (subscription.maxPrice != null) {
    params.push(["price_to", subscription.maxPrice]);
  }
}

export function buildSeoPath(subscription, page = 1) {
  const params = [];
  applyFilters(params, subscription);
  if (page > 1) {
    params.push(["page", page]);
  }
  const query = buildQuery(params);
  const hasCity = subscription.cityId != null || Boolean(subscription.cityName?.trim());
  const path = hasCity
    ? `${SOURCES.BINA_AZ.baseUrl}/${binaCitySlug(subscription.cityId, subscription.cityName)}/alqi-satqi/${categorySlug(subscription)}`
    : `${SOURCES.BINA_AZ.baseUrl}/alqi-satqi/${categorySlug(subscription)}`;
  return query ? `${path}?${query}` : path;
}

export function buildSearchUrl(subscription, page = 1) {
  if (subscription.propertyType) {
    return buildSeoPath(subscription, page);
  }
  const params = [["leased", "false"]];
  const keywords = (subscription.keywords || "").trim();
  if (keywords) {
    params.push(["search_query", keywords]);
  }
  applyFilters(params, subscription);
  if (page > 1) {
    params.push(["page", page]);
  }
  return `${SOURCES.BINA_AZ.baseUrl}/items?${buildQuery(params)}`;
}

function parseCard($, item) {
  const el = $(item);
  const externalId =
    el.attr("data-item-id") ||
    el.find("[data-item-id]").attr("data-item-id") ||
    (el.find("a.item_link[href]").attr("href") || "").match(/\/items\/(\d+)/)?.[1];
  if (!externalId) {
    return null;
  }
  const image = el.find(".preview img[alt], img[alt]").first();
  const title = image.length ? image.attr("alt") : `Elan #${externalId}`;
  const params = el
    .find(".card_params .name li, .name li, .card-params li")
    .map((__, li) => $(li).text())
    .get();
  const region = el.find(".city_when, .location").first().text().trim() || null;
  return listing({
    source: SOURCES.BINA_AZ.name,
    sourceLabel: SOURCES.BINA_AZ.label,
    externalId,
    title,
    price: parsePriceFromText(el.find(".price-val, .price").first().text()),
    currency: "AZN",
    region,
    url: `${SOURCES.BINA_AZ.baseUrl}/items/${externalId}`,
    imageUrl: image.length ? firstNonBlank(image.attr("data-src"), image.attr("src")) : null,
    publishedAt: null,
    areaSqm: parseSqm(params, title),
    landSot: parseSot(params, title),
    roomCount: parseRooms(params, title),
    country: "AZ",
  });
}

export function parse(html) {
  const $ = cheerio.load(html);
  const listings = [];
  const cards = $("#js-items-search .items-i[data-item-id], .items_list .items-i[data-item-id], .items-i[data-item-id]");
  cards.each((_, item) => {
    const parsed = parseCard($, item);
    if (parsed) {
      listings.push(parsed);
    }
  });
  if (listings.length > 0) {
    return listings;
  }
  $("a.item_link[href*='/items/']").each((_, link) => {
    const href = $(link).attr("href") || "";
    const id = href.match(/\/items\/(\d+)/)?.[1];
    if (!id || listings.some((row) => row.externalId === id)) {
      return;
    }
    const parent = $(link).closest(".items-i, article, li");
    const parsed = parseCard($, parent.length ? parent : $(link).parent());
    if (parsed) {
      listings.push(parsed);
    }
  });
  return listings;
}

export async function fetchListings(subscription) {
  return fetchPaginatedListings({
    buildPageUrl: (page) => buildSearchUrl(subscription, page),
    parse,
    max: config.scraper.maxResultsPerSource,
  });
}
