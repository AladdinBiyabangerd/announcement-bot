import * as cheerio from "cheerio";
import { SOURCES } from "../data/sources.js";
import { EMLAK_CITY_BY_BINA } from "./citySlugs.js";
import { listing, dedupeListings } from "./listing.js";
import { fetchPaginatedListings } from "./paginate.js";
import { buildQuery, normalizeWhitespace, parsePriceText, parseRooms, parseSot, parseSqm } from "./textParser.js";
import { SourceFetchError } from "./http.js";
import { config } from "../config.js";

const LISTING_ID_PATTERN = /^\/(\d+)-/;
const FOREIGN_PROPERTY_TYPE = "9";

function extractExternalId(href) {
  const match = LISTING_ID_PATTERN.exec(href);
  return match ? match[1] : null;
}

function housePropertyTypes(subscription) {
  if (subscription.propertyType === "LAND") {
    return ["7"];
  }
  if (subscription.propertyType === "HOUSE") {
    return ["1", "2", "3", "4", "10"];
  }
  return ["1", "2", "3", "4", "10"];
}

export function buildSearchUrl(subscription, page = 1, propertyType = null) {
  const params = [
    ["ann_type", "3"],
    ["sort_type", "0"],
    ["page", String(page)],
  ];
  const type = propertyType || housePropertyTypes(subscription)[0];
  if (type && type !== FOREIGN_PROPERTY_TYPE) {
    params.push(["property_type", type]);
  }
  const city = EMLAK_CITY_BY_BINA[subscription.cityId];
  if (city) {
    params.push(["city", city]);
  }
  if (subscription.roomCount != null) {
    params.push(["room_min", subscription.roomCount]);
  }
  if (subscription.propertyType === "HOUSE" && subscription.areaSqm != null) {
    params.push(["space_min", subscription.areaSqm]);
  }
  if (subscription.propertyType === "LAND" && subscription.landSot != null) {
    params.push(["space_min", subscription.landSot]);
  }
  if (subscription.minPrice != null) {
    params.push(["price_min", subscription.minPrice]);
  }
  if (subscription.maxPrice != null) {
    params.push(["price_max", subscription.maxPrice]);
  }
  return `${SOURCES.EMLAK_AZ.baseUrl}/elanlar/?${buildQuery(params)}`;
}

export function parse(html) {
  const $ = cheerio.load(html);
  const listings = [];
  $("div.ticket-list div.ticket, div.ticket").each((_, ticket) => {
    const el = $(ticket);
    const titleLink = el.find("h6.title a[href], h6 a[href], a[href*='.html']").first();
    if (!titleLink.length) {
      return;
    }
    const href = titleLink.attr("href") || "";
    const externalId = extractExternalId(href);
    if (!externalId) {
      return;
    }
    const title = normalizeWhitespace(titleLink.text());
    const priceEl = el.find("p.price, .price").first();
    const image = el.find("div.img img[src], img[src]").first();
    const region =
      el
        .find(".address .align-right a, .address a")
        .map((__, a) => $(a).text().trim())
        .get()
        .find(Boolean) || null;
    listings.push(
      listing({
        source: SOURCES.EMLAK_AZ.name,
        sourceLabel: SOURCES.EMLAK_AZ.label,
        externalId,
        title,
        price: priceEl.length ? parsePriceText(priceEl.text()) : null,
        currency: "AZN",
        region,
        url: href.startsWith("http") ? href : `${SOURCES.EMLAK_AZ.baseUrl}${href}`,
        imageUrl: image.length
          ? image.attr("src")?.startsWith("http")
            ? image.attr("src")
            : `${SOURCES.EMLAK_AZ.baseUrl}${image.attr("src")}`
          : null,
        publishedAt: null,
        areaSqm: parseSqm([], title),
        landSot: parseSot([], title),
        roomCount: parseRooms([], title),
        country: "AZ",
      }),
    );
  });
  return listings;
}

async function fetchType(subscription, propertyType) {
  const url = buildSearchUrl(subscription, 1, propertyType);
  try {
    return await fetchPaginatedListings({
      buildPageUrl: (page) => buildSearchUrl(subscription, page, propertyType),
      parse: (html) => {
        if (html.includes("Səhifə tapılmadı")) {
          return [];
        }
        return parse(html);
      },
      max: config.scraper.maxResultsPerSource,
    });
  } catch (err) {
    if (err instanceof SourceFetchError && err.message.includes("Səhifə tapılmadı")) {
      console.warn(`emlak.az: ${err.statusCode} — ${url}`);
      return [];
    }
    throw err;
  }
}

export async function fetchListings(subscription) {
  const types = housePropertyTypes(subscription);
  const batches = [];
  for (const type of types) {
    batches.push(await fetchType(subscription, type));
  }
  return dedupeListings(batches.flat());
}
