import { test } from "node:test";
import assert from "node:assert/strict";
import { isDomesticListing, isForeignListing } from "../src/scrape/domestic.js";

test("Azerbaijani listing is domestic", () => {
  assert.equal(
    isDomesticListing({ title: "Həyət evi satılır", region: "Bakı", country: "AZ", url: "https://bina.az/items/1" }),
    true,
  );
});

test("country=AZ does not hide a foreign city in the title", () => {
  assert.equal(
    isForeignListing({ title: "Həyət evi İstanbul", region: "Türkiyə", country: "AZ", url: "https://emlak.az/x" }),
    true,
  );
});

test("Turkey / Dubai listings are foreign", () => {
  assert.equal(isForeignListing({ title: "Mənzil İstanbul", region: "Türkiyə", url: "https://emlak.az/x" }), true);
  assert.equal(isForeignListing({ title: "Villa Dubai", region: "BƏƏ", url: "https://tap.az/x" }), true);
  assert.equal(isDomesticListing({ title: "Xaricdə əmlak, Batumi", region: "Gürcüstan" }), false);
});

test("explicit non-AZ country is foreign when marked abroad", () => {
  assert.equal(isForeignListing({ title: "Apartment", region: "Antalya", country: "TR" }), true);
});
