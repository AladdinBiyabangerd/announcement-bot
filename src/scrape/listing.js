export function listing(partial) {
  return {
    source: partial.source,
    sourceLabel: partial.sourceLabel,
    externalId: String(partial.externalId ?? ""),
    title: partial.title || "",
    price: partial.price ?? null,
    currency: partial.currency || "AZN",
    region: partial.region ?? null,
    url: partial.url,
    imageUrl: partial.imageUrl ?? null,
    publishedAt: partial.publishedAt ?? null,
    areaSqm: partial.areaSqm ?? null,
    landSot: partial.landSot ?? null,
    roomCount: partial.roomCount ?? null,
    hasKupca: partial.hasKupca ?? null,
    documentKind: partial.documentKind ?? null,
    country: partial.country ?? null,
  };
}

export function dedupeListings(listings) {
  const byId = new Map();
  for (const item of listings) {
    if (!item?.externalId) {
      continue;
    }
    const key = `${item.source}:${item.externalId}`;
    if (!byId.has(key)) {
      byId.set(key, item);
    }
  }
  return [...byId.values()];
}
