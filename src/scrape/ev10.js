import * as cheerio from "cheerio";
import { SOURCES } from "../data/sources.js";
import { ev10Location } from "./citySlugs.js";
import { listing } from "./listing.js";
import { fetchPaginatedListings } from "./paginate.js";
import {
  buildQuery,
  firstNonBlank,
  normalizeWhitespace,
  parsePriceNearPosting,
  parsePriceFromText,
  parseRooms,
  parseSot,
  parseSqm,
} from "./textParser.js";
import { config } from "../config.js";

function extractRegion(title) {
  const comma = title.lastIndexOf(",");
  if (comma < 0 || comma >= title.length - 1) {
    return null;
  }
  return title.slice(comma + 1).trim();
}

function categoryPath(subscription) {
  return subscription.propertyType === "LAND" ? "torpaq" : "bag-evi";
}

export function buildSearchUrl(subscription, page = 1) {
  const params = [
    ["page_number", page],
    ["media_type", "image"],
    ["sort_by", "date_desc"],
  ];
  if (subscription.cityId != null || subscription.cityName) {
    params.push(["location", ev10Location(subscription.cityId, subscription.cityName)]);
  }
  if (subscription.minPrice != null) {
    params.push(["min_price", subscription.minPrice]);
  }
  if (subscription.maxPrice != null) {
    params.push(["max_price", subscription.maxPrice]);
  }
  if (subscription.propertyType === "LAND" && subscription.landSot != null) {
    params.push(["min_area", subscription.landSot]);
  }
  if (subscription.propertyType === "HOUSE") {
    if (subscription.areaSqm != null) {
      params.push(["min_area", subscription.areaSqm]);
    }
    if (subscription.roomCount != null) {
      params.push(["rooms", subscription.roomCount]);
    }
  }
  return `${SOURCES.EV10_AZ.baseUrl}/alqi-satqi/${categoryPath(subscription)}?${buildQuery(params)}`;
}

export function parse(html) {
  const $ = cheerio.load(html);
  const byId = new Map();
  $('a[href^="/posting/"]').each((_, link) => {
    const el = $(link);
    const href = el.attr("href") || "";
    const externalId = href.replace(/\/posting\//, "").split(/[?#]/)[0].trim();
    if (!externalId || byId.has(externalId)) {
      return;
    }
    const image = el.find("img[alt]").first();
    const title = image.length
      ? normalizeWhitespace(image.attr("alt"))
      : normalizeWhitespace(el.attr("title") || el.text()) || `Elan #${externalId}`;
    let card = el.parent();
    for (let depth = 0; depth < 10 && card.length; depth += 1) {
      if (/AZN/i.test(card.text())) {
        break;
      }
      card = card.parent();
    }
    const price =
      parsePriceNearPosting(html, externalId) ??
      parsePriceFromText(card.find("span, p").text()) ??
      parsePriceFromText(card.text());
    byId.set(
      externalId,
      listing({
        source: SOURCES.EV10_AZ.name,
        sourceLabel: SOURCES.EV10_AZ.label,
        externalId,
        title,
        price,
        currency: "AZN",
        region: extractRegion(title),
        url: `${SOURCES.EV10_AZ.baseUrl}${href.split("?")[0]}`,
        imageUrl: image.length ? firstNonBlank(image.attr("src"), image.attr("data-src")) : null,
        publishedAt: null,
        areaSqm: parseSqm([title], title),
        landSot: parseSot([title], title),
        roomCount: parseRooms([title], title),
        country: "AZ",
      }),
    );
  });
  return [...byId.values()];
}

export async function fetchListings(subscription) {
  return fetchPaginatedListings({
    buildPageUrl: (page) => buildSearchUrl(subscription, page),
    parse,
    max: config.scraper.maxResultsPerSource,
  });
}
