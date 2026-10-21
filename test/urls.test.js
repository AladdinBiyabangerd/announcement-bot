import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSearchUrl as binaUrl, categoryPaths as binaCategories } from "../src/scrape/bina.js";
import { buildSearchUrl as tapUrl, categoryPaths as tapCategories } from "../src/scrape/tap.js";
import { buildSearchUrl as ev10Url, categoryPaths as ev10Categories } from "../src/scrape/ev10.js";
import { buildSearchUrl as yeniemlakUrl, emlakTypes as yeniemlakTypes } from "../src/scrape/yeniemlak.js";
import { buildSearchUrl as emlakUrl } from "../src/scrape/emlak.js";
import { buildSearchUrl as arendaUrl, categoryPaths as arendaCategories } from "../src/scrape/arenda.js";
import { buildSearchUrl as evvUrl, houseCategories as evvCategories } from "../src/scrape/evv.js";
import { buildSearchUrl as unvanUrl, categoryPaths as unvanCategories } from "../src/scrape/unvan.js";
import { buildSearchUrl as lalafoUrl } from "../src/scrape/lalafo.js";
import { buildSearchUrl as binatapUrl, categoryPaths as binatapCategories } from "../src/scrape/binatap.js";

const landBaku = {
  propertyType: "LAND",
  binaCategoryId: 9,
  cityId: 1,
  cityName: "Bakı",
  landSot: 3,
  maxPrice: 10_000,
};

test("bina builds SEO land URL", () => {
  const url = binaUrl(landBaku);
  assert.match(url, /\/baki\/alqi-satqi\/torpaq/);
  assert.match(url, /area_from=3/);
  assert.match(url, /price_to=10000/);
  assert.equal(url.includes("/items"), false);
});

test("bina builds nationwide URL when city is skipped", () => {
  const url = binaUrl({
    propertyType: "HOUSE",
    binaCategoryId: 2,
    cityId: null,
    cityName: null,
    maxPrice: 150_000,
  });
  assert.match(url, /\/alqi-satqi\/menziller/);
  assert.equal(url.includes("/baki/"), false);
  assert.match(url, /price_to=150000/);
});

test("tap builds torpaq search URL", () => {
  const decoded = decodeURIComponent(tapUrl(landBaku));
  assert.ok(decoded.startsWith("https://tap.az/elanlar/dasinmaz-emlak/torpaq-sahesi?"));
  assert.equal(
    decoded.slice(decoded.indexOf("?") + 1),
    "q[price][]=&q[price][]=10000&keywords_source=typewritten&q[region_id]=420&p[741][]=3&p[741][]=",
  );
});

test("ev10 builds torpaq search URL", () => {
  const url = decodeURIComponent(ev10Url(landBaku));
  assert.match(url, /\/alqi-satqi\/torpaq/);
  assert.match(url, /max_price=10000/);
  assert.match(url, /min_area=3/);
  assert.match(url, /location=Baki-seher/);
});

test("yeniemlak builds torpaq search URL", () => {
  const decoded = decodeURIComponent(yeniemlakUrl(landBaku));
  assert.equal(
    decoded.slice(decoded.indexOf("?") + 1),
    "elan_nov=1&emlak=3&menzil_nov=&qiymet=&qiymet2=10000&mertebe=&mertebe2=&otaq=&otaq2=&sahe_m=&sahe_m2=&sahe_s=3&sahe_s2=&seher[]=7",
  );
});

test("emlak builds valid search URL", () => {
  const url = emlakUrl(landBaku);
  assert.match(url, /\/elanlar\//);
  assert.match(url, /ann_type=3/);
  assert.match(url, /property_type=7/);
  assert.match(url, /city=3/);
  assert.match(url, /space_min=3/);
  assert.match(url, /price_max=10000/);
  assert.equal(url.includes("ann_type=1"), false);
});

test("house search covers menzil, heyet evi and bag evi across sources", () => {
  const house = { propertyType: "HOUSE", cityId: 1, cityName: "Bakı", maxPrice: 150000 };
  assert.deepEqual(binaCategories(house), ["menziller", "heyet-evleri", "bag-evleri"]);
  assert.deepEqual(tapCategories(house), ["menziller", "heyet-evleri", "bag-evleri"]);
  assert.deepEqual(ev10Categories(house), ["menzil", "heyet-evi", "bag-evi"]);
  assert.deepEqual(yeniemlakTypes(house), ["1", "2"]);
  assert.deepEqual(arendaCategories(house), [
    "yeni-tikili",
    "kohne-tikili",
    "heyet-evi-satilir",
    "bag-evi-satilir",
  ]);
  assert.deepEqual(
    evvCategories(house).map((row) => row.slug),
    ["yeni-tikili", "kohne-tikili", "heyet-evi"],
  );
  assert.deepEqual(unvanCategories(house), ["menziller", "heyet-evi-villa"]);
  assert.deepEqual(binatapCategories(house), ["menziller", "heyet-evleri", "bag-evleri"]);
  assert.match(binaUrl(house, 1, "menziller"), /\/baki\/alqi-satqi\/menziller/);
  assert.match(binaUrl(house, 1, "heyet-evleri"), /\/heyet-evleri/);
  assert.match(binaUrl(house, 1, "bag-evleri"), /\/bag-evleri/);
  assert.match(lalafoUrl(house), /\/azerbaijan\/kvartiry$/);
  assert.match(lalafoUrl(house, 1, "/azerbaijan/doma-i-dachi"), /\/doma-i-dachi$/);
  assert.match(lalafoUrl(house, 1, "/azerbaijan/bag-evleri"), /\/bag-evleri$/);
});

test("house URLs pass room and area as minimums", () => {
  const house = {
    propertyType: "HOUSE",
    cityId: 1,
    cityName: "Bakı",
    areaSqm: 100,
    roomCount: 3,
    maxPrice: 150000,
  };
  const bina = decodeURIComponent(binaUrl(house));
  assert.match(bina, /area_from=100/);
  assert.equal(bina.includes("area_to="), false);
  assert.match(bina, /room_ids\[\]=3/);
  assert.match(bina, /room_ids\[\]=4/);
  assert.match(bina, /room_ids\[\]=5\+/);
  const yeniemlak = decodeURIComponent(yeniemlakUrl(house));
  assert.match(yeniemlak, /otaq=3/);
  assert.match(yeniemlak, /otaq2=/);
  assert.doesNotMatch(yeniemlak, /otaq2=3/);
  assert.match(yeniemlak, /sahe_m=100/);
  assert.doesNotMatch(yeniemlak, /sahe_m2=100/);
  const emlak = emlakUrl(house);
  assert.match(emlak, /room_min=3/);
  assert.equal(emlak.includes("room_max="), false);
  assert.match(emlak, /space_min=100/);
  assert.equal(emlak.includes("space_max="), false);
  const evv = decodeURIComponent(evvUrl(house));
  assert.match(evv, /area_min=100/);
  assert.equal(evv.includes("area_max="), false);
  assert.match(evv, /room\[\]=3/);
  assert.match(evv, /room\[\]=4/);
});

test("arenda house and land SEO paths", () => {
  assert.match(arendaUrl({ propertyType: "HOUSE" }), /\/yeni-tikili\/$/);
  assert.match(arendaUrl({ propertyType: "HOUSE" }, 1, "heyet-evi-satilir"), /\/heyet-evi-satilir\/$/);
  assert.match(arendaUrl({ propertyType: "LAND" }), /\/torpaq-satilir\/$/);
});

test("evv uses city apartment path and nationwide axtaris", () => {
  const baku = evvUrl({ propertyType: "HOUSE", cityId: 1, cityName: "Bakı" });
  assert.match(baku, /\/emlak\/baki\/satilir\/yeni-tikili/);
  const land = evvUrl({ propertyType: "LAND", cityId: 1, cityName: "Bakı" });
  assert.match(land, /\/emlak\/baki\/satilir\/torpaq/);
  const nationwide = evvUrl({ propertyType: "HOUSE", cityId: null, cityName: null });
  assert.match(nationwide, /\/axtaris\?/);
  assert.match(nationwide, /category=1/);
  assert.match(nationwide, /type=1/);
});

test("unvan uses dedicated property sections", () => {
  assert.match(unvanUrl({ propertyType: "HOUSE" }), /\/menziller$/);
  assert.match(unvanUrl({ propertyType: "HOUSE" }, 1, "heyet-evi-villa"), /\/heyet-evi-villa$/);
  assert.match(unvanUrl({ propertyType: "LAND" }), /\/torpaq-sahesi$/);
});

test("lalafo uses house and land category paths", () => {
  assert.match(lalafoUrl({ propertyType: "HOUSE" }), /\/azerbaijan\/kvartiry$/);
  assert.match(lalafoUrl({ propertyType: "LAND" }), /\/azerbaijan\/zemelnye-uchastki$/);
});

test("binatap uses menziller and torpaq sale paths", () => {
  const house = binatapUrl({ propertyType: "HOUSE", cityId: 1, cityName: "Bakı" });
  assert.match(house, /\/baki\/alqi-satqi\/menziller$/);
  const land = binatapUrl({ propertyType: "LAND", cityId: null, cityName: null });
  assert.match(land, /\/alqi-satqi\/torpaq$/);
});
