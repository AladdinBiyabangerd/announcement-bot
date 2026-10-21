import * as cheerio from "cheerio";
import { SOURCES } from "../data/sources.js";
import { listing } from "./listing.js";
import { fetchMergedCategoryListings } from "./paginate.js";
import {
  firstNonBlank,
  normalizeWhitespace,
  parsePriceFromText,
  parseRooms,
  parseSot,
  parseSqm,
} from "./textParser.js";

export function categoryPaths(subscription) {
  if (subscription.propertyType === "LAND") {
    return ["torpaq-sahesi"];
  }
  return ["menziller", "heyet-evi-villa"];
}

export function buildSearchUrl(subscription, page = 1, category = null) {
  const url = `${SOURCES.UNVAN_AZ.baseUrl}/${category || categoryPaths(subscription)[0]}`;
  return page > 1 ? `${url}?page=${page}` : url;
}

function listingIdFromHref(href) {
  const match = String(href || "").match(/-(\d+)\.html(?:\?|$)/);
  return match ? match[1] : null;
}

export function parse(html) {
  const $ = cheerio.load(html);
  const listings = [];
  $(".index").each((_, card) => {
    const el = $(card);
    const link = el.find("a[href$='.html']").first();
    const href = link.attr("href") || "";
    const externalId = listingIdFromHref(href);
    if (!externalId) {
      return;
    }
    const title =
      normalizeWhitespace(link.attr("title") || el.find(".prodname").text()) || `Elan #${externalId}`;
    const image = el.find("img").first();
    listings.push(
      listing({
        source: SOURCES.UNVAN_AZ.name,
        sourceLabel: SOURCES.UNVAN_AZ.label,
        externalId,
        title,
        price: parsePriceFromText(el.find(".sprice").first().text()),
        currency: "AZN",
        region: null,
        url: href.startsWith("http") ? href : `${SOURCES.UNVAN_AZ.baseUrl}${href}`,
        imageUrl: image.length
          ? firstNonBlank(image.attr("src")?.startsWith("http") ? image.attr("src") : `${SOURCES.UNVAN_AZ.baseUrl}${image.attr("src")}`)
          : null,
        areaSqm: parseSqm([el.find(".prodful").text()], title),
        landSot: parseSot([el.find(".prodful").text()], title),
        roomCount: parseRooms([el.find(".prodful").text()], title),
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
