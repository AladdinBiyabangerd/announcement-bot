import { test } from "node:test";
import assert from "node:assert/strict";
import { detectKupca, hasOfficialKupca } from "../src/scrape/kupca.js";

test("detects çıxarış / kupça on a detail page", () => {
  const html = `
    <div>Sənədin tipi: Çıxarış (kupça)</div>
    <p>Sənədi çıxarışdır (kupça).</p>`;
  assert.deepEqual(detectKupca(html), { kind: "kupca", hasKupca: true });
  assert.equal(hasOfficialKupca(html), true);
});

test("detects evv JSON-LD Sənəd=Kupça", () => {
  const html = `{"@type":"PropertyValue","name":"Sənəd","value":"Kupça"}`;
  assert.equal(hasOfficialKupca(html), true);
});

test("Bələdiyyə sənədi is not kupça", () => {
  const html = `<div>Sənədin tipi: Bələdiyyə sənədi</div>`;
  assert.deepEqual(detectKupca(html), { kind: "belediye", hasKupca: false });
  assert.equal(hasOfficialKupca(html), false);
});

test("mixed kupça text with Bələdiyyə is not kupça", () => {
  const html = `<p>Kupçalı deyil, Bələdiyyə sənədi var. Çıxarış yoxdur.</p>`;
  assert.equal(hasOfficialKupca(html), false);
  assert.equal(detectKupca(html).kind, "belediye");
});

test("search-page document filter widgets are ignored", () => {
  const html = `
    <input name="emlak_senedi[]" type="checkbox" value="79" id="property-doc-79">
    <label for="property-doc-79">Kupça (Çıxarış)</label>
    <input name="emlak_senedi[]" type="checkbox" value="406" id="property-doc-406">
    <label for="property-doc-406">Bələdiyyə sənədi</label>
    <p>2 sot torpaqda ev satılır.</p>`;
  assert.deepEqual(detectKupca(html), { kind: "none", hasKupca: false });
});

test("arenda search-page kupca_ico is not treated as verified kupça", () => {
  const html = `<button class='satis_novu_ico kupca_ico' data-info='Kupça var'></button>
    <p>Satılır Həyət evi/villa</p>`;
  assert.equal(hasOfficialKupca(html), false);
});

test("çıxarış yoxdur is not kupça", () => {
  assert.equal(hasOfficialKupca("Kupça yoxdur, çıxarış yoxdur"), false);
});
