import { test } from "node:test";
import assert from "node:assert/strict";
import { parse as parseBina } from "../src/scrape/bina.js";
import { parse as parseTap } from "../src/scrape/tap.js";
import { parse as parseEv10 } from "../src/scrape/ev10.js";
import { parse as parseYeniemlak } from "../src/scrape/yeniemlak.js";
import { parse as parseEmlak } from "../src/scrape/emlak.js";
import { parse as parseArenda } from "../src/scrape/arenda.js";
import { parse as parseEvv } from "../src/scrape/evv.js";
import { parse as parseUnvan } from "../src/scrape/unvan.js";
import { parse as parseLalafo } from "../src/scrape/lalafo.js";
import { parse as parseBinatap } from "../src/scrape/binatap.js";
import { parsePriceFromText } from "../src/scrape/textParser.js";

test("bina parses listing cards", () => {
  const html = `
    <div id="js-items-search">
      <div class="items-i" data-item-id="99">
        <a class="item_link" href="/items/99"></a>
        <div class="preview"><img alt="3 otaqlı mənzil" data-src="https://bina.az/img.jpg"/></div>
        <div class="card_params">
          <span class="price-val">1 200</span>
          <ul class="name"><li>3 otaqlı</li><li>110 m²</li></ul>
          <div class="city_when">Bakı, bu gün</div>
        </div>
      </div>
    </div>`;
  const listings = parseBina(html);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].externalId, "99");
  assert.equal(listings[0].title, "3 otaqlı mənzil");
  assert.equal(listings[0].areaSqm, 110);
  assert.equal(listings[0].roomCount, 3);
});

test("price parser reads manat amounts and ignores nearby photo counts", () => {
  assert.equal(parsePriceFromText(" M 360 000 "), 360000);
  assert.equal(parsePriceFromText("Sahibindən 8\n106 000 ₼\n≈ $62 353"), 106000);
});

test("ev10 parses posting cards", () => {
  const html = `
    <a href="/posting/255269">
      <img alt="Satılır,   10 sot
      torpaq ,  Binə q." src="https://cdn.ev10.az/img.webp"/>
    </a>
    7,500 AZN`;
  const listings = parseEv10(html);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].externalId, "255269");
  assert.equal(listings[0].landSot, 10);
  assert.equal(listings[0].region, "Binə q.");
  assert.equal(listings[0].price, 7500);
});

test("yeniemlak parses listing table", () => {
  const html = `
    <table class="list">
      <tr><td class="title"><price>135000</price><titem>Elan: <g><b>990693</b></g></titem></td></tr>
      <tr><td><a class="detail" href="/elan/satilir-3-otaqli-menzil-masazir-990693">Ətraflı</a></td></tr>
      <tr><td class="text">
        <emlak>Bina evi menzil</emlak> / Yeni tikili
        <div class="params"><b>3</b> otaq</div>
        <div class="params"><b>93</b> m2</div>
        <div class="params"><b>Abşeron</b></div><div class="params"><b>Masazır</b></div>
      </td></tr>
    </table>`;
  const listings = parseYeniemlak(html);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].externalId, "990693");
  assert.equal(listings[0].price, 135000);
  assert.equal(listings[0].roomCount, 3);
  assert.equal(listings[0].areaSqm, 93);
});

test("emlak parses ticket cards", () => {
  const html = `
    <div class="ticket-list">
      <div class="ticket">
        <h6 class="title">
          <a href="/1346713-satilir-3-otaqli-96-m2-yeni-tikili.html">Satılır 3 otaqlı 96 m2 yeni tikili</a>
        </h6>
        <p class="price">259 000 AZN</p>
        <div class="address"><div class="align-right"><a>Asan Xidmət-1</a></div></div>
      </div>
    </div>`;
  const listings = parseEmlak(html);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].externalId, "1346713");
  assert.equal(listings[0].price, 259000);
  assert.equal(listings[0].roomCount, 3);
  assert.equal(listings[0].areaSqm, 96);
});

test("tap parses __NEXT_DATA__ ads", () => {
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        apolloState: {
          "Ad:1": {
            __typename: "Ad",
            legacyResourceId: "555",
            path: "/elanlar/555",
            title: "Torpaq 6 sot",
            price: 9000,
            region: "Bakı",
            photo: { url: "https://tap.az/a.jpg" },
          },
        },
      },
    },
  })}</script>`;
  const listings = parseTap(html);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].externalId, "555");
  assert.equal(listings[0].price, 9000);
  assert.equal(listings[0].landSot, 6);
});

test("arenda parses new_elan_box cards without trusting kupca_ico", () => {
  const html = `
    <ul>
      <li class='new_elan_box' id='elan_1445937'>
        <a href='https://arenda.az/satilir-4-otaqli-bag-evi-xezer-rayonu-sagan' title='Satılır Bağ evi Şağan, Xəzər r.'>
          <img data-src='https://arenda.az/uploads/emlak/thumbs/a.jpg' alt='Satılır Bağ evi'/>
          <button class='kupca_ico' data-info='Kupça var'></button>
          <span class='elan_price_new'><span class='jis_azn'>M</span> 470 000</span>
          <p class='elan_elan_nov'>Satılır Bağ evi</p>
          <p class='elan_unvan'>Şağan, Xəzər r.</p>
          <table class='n_elan_box_botom_params'><tr><td>4 otaqlı</td><td>120 m²</td></tr></table>
        </a>
      </li>
    </ul>`;
  const listings = parseArenda(html);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].externalId, "1445937");
  assert.equal(listings[0].price, 470000);
  assert.equal(listings[0].roomCount, 4);
  assert.equal(listings[0].areaSqm, 120);
  assert.equal(listings[0].hasKupca, null);
  assert.equal(listings[0].source, "ARENDA_AZ");
});

test("evv parses prop_col house cards", () => {
  const html = `
    <div class="prop_col">
      <a class="img_link" href="/4-otaqli-heyet-evi-satilir-xezer-baki-86018">
        <img class="prop_main_img" alt="4 otaqlı Həyət evi-Satılır-Xəzər-Bakı" data-src="/uploads/300x200/a.webp"/>
      </a>
      <div class="fav" data-id="86018"></div>
      <div class="prop_detail">
        <span class="title" title="Satılır / Həyət evi / Bakı, Xəzər, Buzovna">Satılır / Həyət evi / Bakı, Xəzər, Buzovna</span>
        <div class="small_props_list"><span>4 otaqlı, 100 m²</span></div>
        <div class="price_val">106 000</div>
        <div class="small_props_list"><span>Buzovna qəs.</span></div>
      </div>
    </div>`;
  const listings = parseEvv(html);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].externalId, "86018");
  assert.equal(listings[0].price, 106000);
  assert.equal(listings[0].roomCount, 4);
  assert.equal(listings[0].areaSqm, 100);
  assert.equal(listings[0].region, "Buzovna qəs.");
});

test("unvan parses index cards", () => {
  const html = `
    <div class="index">
      <div class="holderimg">
        <a href="/mastagada-kupcali-ev-satilir-62022824.html" title="Mastağada kupçali ev satılır">
          <img src="/uploads/news/product.jpg" alt="Mastağada kupçali ev satılır"/>
        </a>
      </div>
      <div class="prodname"><a href="/mastagada-kupcali-ev-satilir-62022824.html">Mastağada kupçali ev satılır</a></div>
      <span class="sprice">85000 Azn</span>
    </div>`;
  const listings = parseUnvan(html);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].externalId, "62022824");
  assert.equal(listings[0].price, 85000);
  assert.equal(listings[0].hasKupca, null);
});

test("lalafo parses listingFeed items", () => {
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      initialState: {
        listing: {
          listingFeed: {
            data: {
              items: [
                {
                  id: 93709983,
                  country_id: 13,
                  title: "5 otaqlı həyət evi, 140 m²",
                  price: 127000,
                  currency: "AZN",
                  city: "Bakı",
                  url: "/baku/ads/heyet-evi-id-93709983",
                  images: [{ is_main: true, original_url: "https://img.lalafo.com/a.jpg" }],
                },
              ],
            },
          },
        },
      },
    },
  })}</script>`;
  const listings = parseLalafo(html);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].externalId, "93709983");
  assert.equal(listings[0].price, 127000);
  assert.equal(listings[0].roomCount, 5);
  assert.equal(listings[0].country, "AZ");
});

test("lalafo drops non-Azerbaijan country_id", () => {
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      initialState: {
        listing: {
          listingFeed: {
            data: { items: [{ id: 1, country_id: 1, title: "House", price: 10, url: "/ads/1" }] },
          },
        },
      },
    },
  })}</script>`;
  assert.equal(parseLalafo(html).length, 0);
});

test("binatap parses bt-card listings", () => {
  const html = `
    <article class="bt-card">
      <img alt="Satılır 3 otaqlı həyət evi / bağ evi 100 m², Buzovna" src="https://binatap.az/img.webp"/>
      <div>106 000&nbsp;₼</div>
      <a href="https://binatap.az/elan/satilir-3-otaqli-heyet-evi-bag-evi-100-m2-buzovna-qesebes-3444" class="bt-card-link">Xəzər r.</a>
      <div>3 otaqlı · 100 m²</div>
      <span>Bakı, Bugün 17:27</span>
    </article>`;
  const listings = parseBinatap(html);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].externalId, "3444");
  assert.equal(listings[0].price, 106000);
  assert.equal(listings[0].roomCount, 3);
  assert.equal(listings[0].areaSqm, 100);
});
