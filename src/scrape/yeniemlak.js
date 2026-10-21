import * as cheerio from "cheerio";
import { SOURCES } from "../data/sources.js";
import { YENIEMLAK_CITY_BY_BINA } from "./citySlugs.js";
import { listing } from "./listing.js";
import { fetchMergedCategoryListings } from "./paginate.js";
import { buildQuery, normalizeWhitespace, parsePriceText, parseRooms, parseSot } from "./textParser.js";

const LISTING_ID_PATTERN = /-([0-9]+)$/;

function extractExternalId(slug) {
  const match = LISTING_ID_PATTERN.exec(slug);
  return match ? match[1] : null;
}

function buildTitle(textCell, $) {
  if (!textCell.length) {
    return "";
  }
  const type = textCell.find("emlak").first().text() || "";
  const params = textCell
    .find(".params")
    .map((_, el) => $(el).text())
    .get();
  return normalizeWhitespace(`${type} ${params.join(" ")}`);
}

function buildRegion(textCell, $) {
  if (!textCell.length) {
    return null;
  }
  const regions = textCell
    .find(".params b")
    .map((_, el) => $(el).text())
    .get()
    .filter(Boolean);
  return regions.length ? regions.join(", ") : null;
}

function parseYeniemlakSqm(params) {
  for (const param of params) {
    const lower = param.toLowerCase();
    if (lower.includes("m2") || lower.includes("m²") || lower.includes(" m ")) {
      const match = /(\d+)/.exec(param);
      if (match) {
        return Number(match[1]);
      }
    }
  }
  return null;
}

export function emlakTypes(subscription) {
  if (subscription.propertyType === "LAND") {
    return ["3"];
  }
  return ["1", "2"];
}

export function buildSearchUrl(subscription, page = 1, emlakType = null) {
  const land = subscription.propertyType === "LAND";
  const house = subscription.propertyType === "HOUSE";
  const params = [
    ["elan_nov", "1"],
    ["emlak", emlakType || emlakTypes(subscription)[0]],
    ["menzil_nov", ""],
    ["qiymet", subscription.minPrice ?? ""],
    ["qiymet2", subscription.maxPrice ?? ""],
    ["mertebe", ""],
    ["mertebe2", ""],
    ["otaq", house && subscription.roomCount != null ? subscription.roomCount : ""],
    ["otaq2", ""],
    ["sahe_m", house && subscription.areaSqm != null ? subscription.areaSqm : ""],
    ["sahe_m2", ""],
    ["sahe_s", land && subscription.landSot != null ? subscription.landSot : ""],
    ["sahe_s2", ""],
  ];
  const city = YENIEMLAK_CITY_BY_BINA[subscription.cityId];
  if (city) {
    params.push(["seher[]", city]);
  }
  if (page > 1) {
    params.push(["page", page]);
  }
  return `${SOURCES.YENIEMLAK_AZ.baseUrl}/elan/axtar?${buildQuery(params)}`;
}

export function parse(html) {
  const $ = cheerio.load(html);
  const listings = [];
  $("table.list").each((_, table) => {
    const el = $(table);
    const detailLink = el.find('a.detail[href^="/elan/"]').first();
    if (!detailLink.length) {
      return;
    }
    const slug = detailLink.attr("href") || "";
    const externalId = extractExternalId(slug);
    if (!externalId) {
      return;
    }
    const price = parsePriceText(el.find("price").first().text() || null);
    const textCell = el.find("td.text").first();
    const title = buildTitle(textCell, $);
    const params = textCell.length
      ? textCell
          .find(".params")
          .map((__, p) => $(p).text())
          .get()
      : [];
    const image = el.find("img[src]").first();
    listings.push(
      listing({
        source: SOURCES.YENIEMLAK_AZ.name,
        sourceLabel: SOURCES.YENIEMLAK_AZ.label,
        externalId,
        title,
        price,
        currency: "AZN",
        region: buildRegion(textCell, $),
        url: `${SOURCES.YENIEMLAK_AZ.baseUrl}${slug}`,
        imageUrl: image.length ? `${SOURCES.YENIEMLAK_AZ.baseUrl}${image.attr("src")}` : null,
        publishedAt: null,
        areaSqm: parseYeniemlakSqm(params),
        landSot: parseSot(params, title),
        roomCount: parseRooms(params, title),
        country: "AZ",
      }),
    );
  });
  return listings;
}

export async function fetchListings(subscription) {
  return fetchMergedCategoryListings({
    categories: emlakTypes(subscription),
    buildPageUrl: (page, emlakType) => buildSearchUrl(subscription, page, emlakType),
    parse,
  });
}
