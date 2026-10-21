import { test } from "node:test";
import assert from "node:assert/strict";
import { matches } from "../src/scrape/matcher.js";

function listing(title, price, extra = {}) {
  return {
    source: extra.source || "TAP_AZ",
    externalId: "1",
    title,
    price,
    currency: "AZN",
    region: extra.region ?? "Bakı",
    url: extra.url || "https://tap.az/elanlar/1",
    imageUrl: null,
    landSot: extra.landSot ?? null,
    areaSqm: extra.areaSqm ?? null,
    roomCount: extra.roomCount ?? null,
    hasKupca: extra.hasKupca ?? null,
    documentKind: extra.documentKind ?? null,
    country: extra.country ?? "AZ",
  };
}

test("matches when keywords and price fit", () => {
  assert.equal(
    matches(listing("Apple iPhone 13", 1200), { keywords: "iphone", minPrice: 500, maxPrice: 2000 }),
    true,
  );
});

test("rejects when keyword missing", () => {
  assert.equal(
    matches(listing("Apple iPhone 13", 1200), { keywords: "samsung", minPrice: 100, maxPrice: 5000 }),
    false,
  );
});

test("rejects when price too high", () => {
  assert.equal(
    matches(listing("Apple iPhone 13", 1200), { keywords: "iphone", minPrice: 100, maxPrice: 500 }),
    false,
  );
});

test("land search rejects smaller sot and accepts larger", () => {
  const subscription = { propertyType: "LAND", landSot: 3, cityName: "Bakı", maxPrice: 10_000 };
  assert.equal(matches(listing("Torpaq - 1 sot", 5000, { landSot: 1 }), subscription), false);
  assert.equal(matches(listing("Torpaq - 5 sot", 8000, { landSot: 5 }), subscription), true);
});

test("land search rejects apartment", () => {
  assert.equal(
    matches(listing("3 otaqlı mənzil 90 m²", 100_000), { propertyType: "LAND", landSot: 3, cityName: "Bakı" }),
    false,
  );
});

test("house search accepts apartment, heyet evi and bag evi", () => {
  const subscription = { propertyType: "HOUSE", cityName: "Bakı" };
  assert.equal(matches(listing("3 otaqlı mənzil, yeni tikili 90 m²", 120_000, { roomCount: 3, areaSqm: 90 }), subscription), true);
  assert.equal(matches(listing("2 otaqlı köhnə tikili 60 m²", 90_000, { roomCount: 2, areaSqm: 60 }), subscription), true);
  assert.equal(matches(listing("Həyət evi 4 otaqlı", 80_000, { roomCount: 4 }), subscription), true);
  assert.equal(matches(listing("Bağ evi 5 otaqlı", 95_000, { roomCount: 5 }), subscription), true);
});

test("house room and area filters are minimums", () => {
  const subscription = { propertyType: "HOUSE", cityName: "Bakı", roomCount: 3, areaSqm: 100 };
  assert.equal(
    matches(listing("2 otaqlı mənzil 120 m²", 90_000, { roomCount: 2, areaSqm: 120 }), subscription),
    false,
  );
  assert.equal(
    matches(listing("3 otaqlı mənzil 90 m²", 90_000, { roomCount: 3, areaSqm: 90 }), subscription),
    false,
  );
  assert.equal(
    matches(listing("3 otaqlı mənzil 100 m²", 90_000, { roomCount: 3, areaSqm: 100 }), subscription),
    true,
  );
  assert.equal(
    matches(listing("5 otaqlı həyət evi 140 m²", 90_000, { roomCount: 5, areaSqm: 140 }), subscription),
    true,
  );
});

test("house search rejects land", () => {
  assert.equal(
    matches(listing("Torpaq 10 sot", 5000, { landSot: 10 }), {
      propertyType: "HOUSE",
      roomCount: 3,
      cityName: "Bakı",
    }),
    false,
  );
});

test("rejects foreign listings even when other filters match", () => {
  assert.equal(
    matches(listing("Həyət evi İstanbul", 80_000, { region: "Türkiyə", roomCount: 3 }), {
      propertyType: "HOUSE",
      cityName: "Bakı",
    }),
    false,
  );
});

test("kupça filter requires detail-verified hasKupca", () => {
  const subscription = { propertyType: "HOUSE", cityName: "Bakı", requireKupca: true };
  assert.equal(
    matches(listing("Həyət evi 3 otaqlı", 80_000, { roomCount: 3 }), subscription),
    false,
  );
  assert.equal(
    matches(
      listing("Həyət evi 3 otaqlı", 80_000, { roomCount: 3, hasKupca: true, documentKind: "kupca" }),
      subscription,
    ),
    true,
  );
  assert.equal(
    matches(
      listing("Həyət evi 3 otaqlı", 80_000, {
        roomCount: 3,
        hasKupca: false,
        documentKind: "belediye",
      }),
      subscription,
    ),
    false,
  );
});
