import { test } from "node:test";
import assert from "node:assert/strict";
import { isCloudflareChallengeBody } from "../src/scrape/http.js";
import { roomIdsFromMin, evvRoomIdsFromMin } from "../src/scrape/minFilters.js";

test("cloudflare challenge pages are detected without a bypass hint", () => {
  assert.equal(isCloudflareChallengeBody("Attention Required! | Cloudflare"), true);
  assert.equal(isCloudflareChallengeBody("<html>normal listing</html>"), false);
});

test("room minimums expand to all larger room ids", () => {
  assert.deepEqual(roomIdsFromMin(3), ["3", "4", "5+"]);
  assert.deepEqual(evvRoomIdsFromMin(3), ["3", "4"]);
  assert.deepEqual(evvRoomIdsFromMin(5), ["4"]);
});
