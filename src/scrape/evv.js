import * as cheerio from "cheerio";
import { SOURCES } from "../data/sources.js";
import { evvCitySlug } from "./citySlugs.js";
import { listing } from "./listing.js";
import { fetchPaginatedListings } from "./paginate.js";
import {
  buildQuery,
  firstNonBlank,
  normalizeWhitespace,
  parsePriceFromText,
  parseRooms,
  parseSot,
  parseSqm,
} from "./textParser.js";
import { config } from "../config.js";

const PAGE_SIZE = 24;

function categorySlug(subscription) {
  return subscription.propertyType === "LAND" ? "torpaq" : "heyet-evi";
}

function categoryId(subscription) {
  return subscription.propertyType === "LAND" ? "5" : "3";
}

function hasCity(subscription) {
  return subscription.cityId != null || Boolean(subscription.cityName?.trim());
}

export function buildSearchUrl(subscription, page = 1) {
  const params = [["type", "1"]];
  if (subscription.minPrice != null) {
    params.push(["price_min", subscription.minPrice]);
  }
  if (subscription.maxPrice != null) {
    params.push(["price_max", subscription.maxPrice]);
  }
  if (subscription.propertyType === "HOUSE" && subscription.areaSqm != null) {
    params.push(["area_min", subscription.areaSqm]);
    params.push(["area_max", subscription.areaSqm]);
  }
  if (subscription.propertyType === "LAND" && subscription.landSot != null) {
    params.push(["area2_min", subscription.landSot]);
  }
  if (subscription.roomCount != null) {
    params.push(["room[]", subscription.roomCount >= 5 ? "4" : String(subscription.roomCount)]);
  }
  if (page > 1) {
    params.push(["page", String((page - 1) * PAGE_SIZE)]);
  }
  if (hasCity(subscription)) {
    const city = evvCitySlug(subscription.cityId, subscription.cityName);
    const path = `${SOURCES.EVV_AZ.baseUrl}/emlak/${city}/satilir/${categorySlug(subscription)}`;
    const query = buildQuery(params.filter(([key]) => key !== "type"));
    return query ? `${path}?${query}` : path;
  }
  params.push(["category", categoryId(subscription)]);
  params.push(["city", "0"]);
  return `${SOURCES.EVV_AZ.baseUrl}/axtaris?${buildQuery(params)}`;
}

function listingIdFromHref(href) {
  const match = String(href || "").match(/-(\d+)(?:\/)?(?:\?|$)/);
  return match ? match[1] : null;
}

export function parse(html) {
  const $ = cheerio.load(html);
  const listings = [];
  $(".prop_col").each((_, card) => {
    const el = $(card);
    const link = el.find("a.img_link[href], a[href*='satilir']").first();
    const href = link.attr("href") || "";
    const externalId = el.find(".fav[data-id]").attr("data-id") || listingIdFromHref(href);
    if (!externalId || !href) {
      return;
    }
    const title =
      normalizeWhitespace(el.find(".title").attr("title") || el.find(".title").text()) ||
      normalizeWhitespace(el.find("img.prop_main_img").attr("alt")) ||
      `Elan #${externalId}`;
    const details = el.find(".small_props_list span, .other_details").text();
    listings.push(
      listing({
        source: SOURCES.EVV_AZ.name,
        sourceLabel: SOURCES.EVV_AZ.label,
        externalId,
        title,
        price: parsePriceFromText(el.find(".price_val").first().text()),
        currency: "AZN",
        region:
          normalizeWhitespace(el.find(".small_props_list").last().find("span").first().text()) ||
          title.split("/").slice(-1)[0]?.trim() ||
          null,
        url: href.startsWith("http") ? href : `${SOURCES.EVV_AZ.baseUrl}${href}`,
        imageUrl: (() => {
          const image = el.find("img.prop_main_img").first();
          return image.length ? firstNonBlank(image.attr("data-src"), image.attr("src")) : null;
        })(),
        areaSqm: parseSqm([details], title),
        landSot: parseSot([details], title),
        roomCount: parseRooms([details], title),
        country: "AZ",
      }),
    );
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
