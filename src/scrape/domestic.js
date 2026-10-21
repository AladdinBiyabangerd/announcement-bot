import { allCities, normalizeCity } from "../data/cities.js";

const FOREIGN_MARKERS = [
  "türkiyə",
  "turkiye",
  "turkey",
  "istanbul",
  "antalya",
  "ankara",
  "izmir",
  "bursa",
  "alanya",
  "trabzon",
  "gürcüstan",
  "gurcustan",
  "georgia",
  "batumi",
  "tbilisi",
  "tbilisi",
  "rusiya",
  "russia",
  "moskva",
  "moscow",
  "sochi",
  "bəə",
  "bae",
  "uae",
  "dubai",
  "abudabi",
  "abu dhabi",
  "almaniya",
  "germany",
  "berlin",
  "fransa",
  "france",
  "paris",
  "ingiltərə",
  "ingiltere",
  "london",
  "xaricdə əmlak",
  "xaricde emlak",
  "xaricdə",
  "xaricde",
  "abroad",
  "foreign property",
];

const AZ_COUNTRY = /^(az|aze|azerbaijan|azərbaycan|azerbaycan)$/iu;

let cityNeedles = null;

function azCityNeedles() {
  if (cityNeedles) {
    return cityNeedles;
  }
  cityNeedles = allCities().map((city) => normalizeCity(city.name));
  return cityNeedles;
}

function haystackOf(listing) {
  return normalizeCity(
    [listing.title, listing.region, listing.url, listing.country, listing.sourceLabel]
      .filter(Boolean)
      .join(" "),
  );
}

export function isForeignListing(listing) {
  if (!listing) {
    return true;
  }
  const haystack = haystackOf(listing);
  if (FOREIGN_MARKERS.some((marker) => haystack.includes(normalizeCity(marker)))) {
    return true;
  }
  const country = String(listing.country || "").trim();
  if (country && AZ_COUNTRY.test(country)) {
    return false;
  }
  if (country && !AZ_COUNTRY.test(country) && country.length <= 20) {
    const folded = normalizeCity(country);
    if (!azCityNeedles().some((city) => folded.includes(city) || city.includes(folded))) {
      if (FOREIGN_MARKERS.some((marker) => folded.includes(normalizeCity(marker)))) {
        return true;
      }
    }
  }
  return false;
}

export function isDomesticListing(listing) {
  return !isForeignListing(listing);
}
