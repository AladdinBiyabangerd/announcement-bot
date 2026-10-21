import { config } from "../config.js";
import { fetchHtml } from "./http.js";
import { detectKupca } from "./kupca.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function enrichListingDocument(listing) {
  if (!listing?.url) {
    return { ...listing, hasKupca: false, documentKind: "none" };
  }
  try {
    const html = await fetchHtml(listing.url);
    const detected = detectKupca(`${listing.title || ""}\n${html}`);
    return {
      ...listing,
      hasKupca: detected.hasKupca,
      documentKind: detected.kind,
    };
  } catch (err) {
    console.warn(
      `Detal səhifə oxunmadı: source=${listing.source} id=${listing.externalId} url=${listing.url}`,
      err?.message || err,
    );
    return { ...listing, hasKupca: false, documentKind: "none" };
  }
}

export async function enrichKupcaIfNeeded(listing, subscription) {
  if (!subscription?.requireKupca) {
    return listing;
  }
  if (listing.hasKupca === true && listing.documentKind === "kupca") {
    return listing;
  }
  await sleep(Math.min(800, config.scraper.requestDelayMs));
  return enrichListingDocument(listing);
}
