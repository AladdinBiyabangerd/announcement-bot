import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFlareSolverrRequest } from "../src/scrape/http.js";
import { roomIdsFromMin, evvRoomIdsFromMin } from "../src/scrape/minFilters.js";

test("FlareSolverr request reuses a session and can attach a proxy", () => {
  const body = buildFlareSolverrRequest("https://bina.az/alqi-satqi/menziller", {
    session: "announcement-bot",
    proxy: "http://user:pass@proxy-host:8080",
  });
  assert.equal(body.cmd, "request.get");
  assert.equal(body.session, "announcement-bot");
  assert.equal(body.maxTimeout, 60_000);
  assert.deepEqual(body.proxy, { url: "http://user:pass@proxy-host:8080" });
});

test("room minimums expand to all larger room ids", () => {
  assert.deepEqual(roomIdsFromMin(3), ["3", "4", "5+"]);
  assert.deepEqual(evvRoomIdsFromMin(3), ["3", "4"]);
  assert.deepEqual(evvRoomIdsFromMin(5), ["4"]);
});
