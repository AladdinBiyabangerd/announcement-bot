import * as cheerio from "cheerio";
import { SOURCES } from "../data/sources.js";
import { listing, dedupeListings } from "./listing.js";
import { fetchPaginatedListings } from "./paginate.js";
import {
  firstNonBlank,
  normalizeWhitespace,
  parsePriceFromText,
  parseRooms,
  parseSot,
  parseSqm,
} from "./textParser.js";
import { config } from "../config.js";

export function categoryPaths(subscription) {
  if (subscription.propertyType === "LAND") {
    return ["torpaq-satilir"];
  }
  return ["yeni-tikili", "kohne-tikili", "heyet-evi-satilir", "bag-evi-satilir"];
}

export function buildSearchUrl(subscription, page = 1, path = null) {
  const category = path || categoryPaths(subscription)[0];
  const url = `${SOURCES.ARENDA_AZ.baseUrl}/${category}/`;
  if (page > 1) {
    return `${url}?page=${page}`;
  }
  return url;
}

function parseCard($, item) {
  const el = $(item);
  const id = (el.attr("id") || "").replace(/^elan_/, "");
  const link = el.find("a[href]").first();
  const href = link.attr("href") || "";
  const externalId = id || href.match(/-(\d+)(?:\/)?(?:\?|$)/)?.[1];
  if (!externalId || !href) {
    return null;
  }
  const title =
    normalizeWhitespace(link.attr("title") || "") ||
    normalizeWhitespace(
      `${el.find(".elan_elan_nov").first().text()} ${el.find(".elan_unvan").first().text()}`,
    ) ||
    `Elan #${externalId}`;
  const params = el
    .find("table.n_elan_box_botom_params td")
    .map((_, td) => $(td).text())
    .get();
  const image = el.find("img").first();
  return listing({
    source: SOURCES.ARENDA_AZ.name,
    sourceLabel: SOURCES.ARENDA_AZ.label,
    externalId,
    title,
    price: parsePriceFromText(el.find(".elan_price_new").first().text()),
    currency: "AZN",
    region: normalizeWhitespace(el.find(".elan_unvan").first().text()) || null,
    url: href.startsWith("http") ? href : `${SOURCES.ARENDA_AZ.baseUrl}${href}`,
    imageUrl: image.length
      ? firstNonBlank(image.attr("data-src"), image.attr("src"))
      : null,
    areaSqm: parseSqm(params, title),
    landSot: parseSot(params, title),
    roomCount: parseRooms(params, title),
    country: "AZ",
  });
}

export function parse(html) {
  const $ = cheerio.load(html);
  const listings = [];
  $("li.new_elan_box[id^='elan_'], li[id^='elan_']").each((_, item) => {
    const parsed = parseCard($, item);
    if (parsed) {
      listings.push(parsed);
    }
  });
  return listings;
}

export async function fetchListings(subscription) {
  const batches = [];
  for (const path of categoryPaths(subscription)) {
    batches.push(
      await fetchPaginatedListings({
        buildPageUrl: (page) => buildSearchUrl(subscription, page, path),
        parse,
        max: config.scraper.maxResultsPerSource,
      }),
    );
  }
  return dedupeListings(batches.flat());
}
