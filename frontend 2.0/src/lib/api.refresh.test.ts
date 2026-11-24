import { test } from "node:test";
import assert from "node:assert/strict";
import { setRefreshHandler, getFollowups } from "./api.ts";

// doc 27 item 5 — a burst of concurrent 401s must dedupe into ONE refresh
// call (refresh tokens rotate: parallel calls race each other's invalidation).

test("concurrent 401s produce exactly one refresh call", async () => {
  let refreshCalls = 0;
  setRefreshHandler(
    () =>
      new Promise<string>((resolve) => {
        refreshCalls += 1;
        // settle on a later macrotask so all requests observe the shared
        // in-flight promise before it clears
        setTimeout(() => resolve("fresh-token"), 10);
      }),
  );

  const originalFetch = globalThis.fetch;
  const fetchMock = async (_url: unknown, init?: { headers?: Record<string, string> }) => {
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization ?? "";
    if (auth === "Bearer expired") {
      return new Response("{}", { status: 401 });
    }
    assert.equal(auth, "Bearer fresh-token");
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  globalThis.fetch = fetchMock as typeof fetch;

  try {
    await Promise.all([
      getFollowups("expired"),
      getFollowups("expired"),
      getFollowups("expired"),
      getFollowups("expired"),
      getFollowups("expired"),
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    setRefreshHandler(null);
  }

  assert.equal(refreshCalls, 1);
});