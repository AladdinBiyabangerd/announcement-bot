import * as cheerio from "cheerio";
import { SOURCES } from "../data/sources.js";
import { binaCitySlug } from "./citySlugs.js";
import { listing } from "./listing.js";
import { fetchMergedCategoryListings } from "./paginate.js";
import {
  buildQuery,
  firstNonBlank,
  normalizeWhitespace,
  parsePriceFromText,
  parseRooms,
  parseSot,
  parseSqm,
} from "./textParser.js";

export function categoryPaths(subscription) {
  if (subscription.propertyType === "LAND") {
    return ["torpaq"];
  }
  return ["menziller", "heyet-evleri", "bag-evleri"];
}

function hasCity(subscription) {
  return subscription.cityId != null || Boolean(subscription.cityName?.trim());
}

export function buildSearchUrl(subscription, page = 1, category = null) {
  const params = [];
  if (page > 1) {
    params.push(["page", page]);
  }
  const query = buildQuery(params);
  const slug = category || categoryPaths(subscription)[0];
  const path = hasCity(subscription)
    ? `${SOURCES.BINATAP_AZ.baseUrl}/${binaCitySlug(subscription.cityId, subscription.cityName)}/alqi-satqi/${slug}`
    : `${SOURCES.BINATAP_AZ.baseUrl}/alqi-satqi/${slug}`;
  return query ? `${path}?${query}` : path;
}

function listingIdFromHref(href) {
  const match = String(href || "").match(/-(\d+)(?:\/)?(?:\?|$)/);
  return match ? match[1] : null;
}

export function parse(html) {
  const $ = cheerio.load(html);
  const listings = [];
  $("article.bt-card").each((_, card) => {
    const el = $(card);
    const link = el.find("a[href*='/elan/']").first();
    const href = link.attr("href") || "";
    const externalId = listingIdFromHref(href);
    if (!externalId) {
      return;
    }
    const image = el.find("img[alt]").first();
    const title =
      normalizeWhitespace(image.attr("alt")) ||
      normalizeWhitespace(link.attr("title") || link.text()) ||
      `Elan #${externalId}`;
    const regionLink = el.find("a.bt-card-link").first().text();
    const locationLine = el
      .find("span")
      .filter((_, span) => /Bakı|Gəncə|Sumqayıt|Xırdalan|,/.test($(span).text()))
      .first()
      .text();
    listings.push(
      listing({
        source: SOURCES.BINATAP_AZ.name,
        sourceLabel: SOURCES.BINATAP_AZ.label,
        externalId,
        title,
        price: parsePriceFromText(el.text()),
        currency: "AZN",
        region: normalizeWhitespace(regionLink || locationLine) || null,
        url: href.startsWith("http") ? href : `${SOURCES.BINATAP_AZ.baseUrl}${href}`,
        imageUrl: image.length ? firstNonBlank(image.attr("src"), image.attr("data-src")) : null,
        areaSqm: parseSqm([el.text()], title),
        landSot: parseSot([el.text()], title),
        roomCount: parseRooms([el.text()], title),
        country: "AZ",
      }),
    );
  });
  if (listings.length) {
    return listings;
  }
  $("a[href*='/elan/']").each((_, link) => {
    const el = $(link);
    const href = el.attr("href") || "";
    const externalId = listingIdFromHref(href);
    if (!externalId || listings.some((row) => row.externalId === externalId)) {
      return;
    }
    const title = normalizeWhitespace(el.attr("title") || el.text()) || `Elan #${externalId}`;
    listings.push(
      listing({
        source: SOURCES.BINATAP_AZ.name,
        sourceLabel: SOURCES.BINATAP_AZ.label,
        externalId,
        title,
        price: parsePriceFromText(el.closest("article, div").text()),
        currency: "AZN",
        region: null,
        url: href.startsWith("http") ? href : `${SOURCES.BINATAP_AZ.baseUrl}${href}`,
        imageUrl: null,
        areaSqm: parseSqm([], title),
        landSot: parseSot([], title),
        roomCount: parseRooms([], title),
        country: "AZ",
      }),
    );
  });
  return listings;
}

export async function fetchListings(subscription) {
  return fetchMergedCategoryListings({
    categories: categoryPaths(subscription),
    buildPageUrl: (page, category) => buildSearchUrl(subscription, page, category),
    parse,
  });
}
