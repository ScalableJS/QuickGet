import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTopicUrl, parseTopicTarget } from "./tracker-login.mjs";

test("normalizeTopicUrl removes one matching pair of quotes", () => {
  assert.equal(normalizeTopicUrl('"https://tracker.example/topic/42"'), "https://tracker.example/topic/42");
  assert.equal(normalizeTopicUrl("'https://tracker.example/topic/42'"), "https://tracker.example/topic/42");
  assert.equal(normalizeTopicUrl("'https://tracker.example/topic/42\""), "'https://tracker.example/topic/42\"");
});

test("parseTopicTarget accepts only absolute HTTP(S) targets", () => {
  assert.deepEqual(parseTopicTarget('"https://tracker.example/topic/42?download=1"'), {
    topicUrl: "https://tracker.example/topic/42?download=1",
    origin: "https://tracker.example",
  });
  assert.equal(parseTopicTarget("ftp://tracker.example/topic/42"), null);
  assert.equal(parseTopicTarget("not a URL"), null);
  assert.equal(parseTopicTarget(""), null);
});
