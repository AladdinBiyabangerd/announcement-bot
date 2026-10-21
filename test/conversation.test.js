import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.js";
import { registerUser } from "../src/store.js";
import { finishAndSubscribe } from "../src/telegram/conversation.js";

test("sends confirmation immediately even if the initial scan never finishes", async (t) => {
  const db = openDb(":memory:");
  t.after(() => db.close());
  const user = registerUser(db, 42, "ali", "Ali", "az");
  const sent = [];
  let resolveScan;
  let scanFinished = false;
  const scanPromise = new Promise((resolve) => {
    resolveScan = resolve;
  });
  t.after(() => resolveScan());

  await finishAndSubscribe(
    db,
    42,
    {
      propertyType: "LAND",
      cityId: 1,
      cityName: "Bakı",
      landSot: 3,
      requireKupca: true,
      maxPrice: 12000,
    },
    {
      sendHtml: async (chatId, html) => {
        sent.push({ chatId, html });
      },
      processSubscription: async () => {
        await scanPromise;
        scanFinished = true;
      },
    },
  );

  assert.equal(user.chatId, 42);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].chatId, 42);
  assert.match(sent[0].html, /Axtarış aktivdir/);
  assert.match(sent[0].html, /#1/);
  assert.match(sent[0].html, /Torpaq: 3 sot\+/);
  assert.match(sent[0].html, /Bakı/);
  assert.equal(scanFinished, false);
  assert.doesNotMatch(sent[0].html, /Cloudflare|403|əlçatan deyil|blok/i);
});
