import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyFormChanges,
  buildSwiperParams,
  configToForm,
  normalizeConfig,
} from "../src/config.js";

const edit = (config, changes) => {
  const prev = configToForm(config);
  return applyFormChanges(config, prev, { ...prev, ...changes });
};

test("normalizeConfig never throws and always yields a cards array", () => {
  assert.deepEqual(normalizeConfig(undefined).cards, []);
  assert.deepEqual(normalizeConfig(null).cards, []);
  assert.deepEqual(normalizeConfig({ cards: "x" }).cards, []);
  assert.equal(normalizeConfig({ parameters: "bad" }).parameters, undefined);
});

test("legacy YAML null modules read as enabled", () => {
  const f = configToForm({ parameters: { pagination: null, navigation: null, scrollbar: null } });
  assert.equal(f.pagination, "bullets");
  assert.equal(f.navigation, true);
  assert.equal(f.scrollbar, true);
});

test("pagination round trip keeps unknown sub-keys", () => {
  const cfg = { type: "custom:swipe-card", cards: [], parameters: { pagination: { type: "bullets", el: "x", bulletClass: "b" } } };
  const out = edit(cfg, { pagination: "fraction" });
  assert.deepEqual(out.parameters.pagination, { type: "fraction", el: "x", bulletClass: "b", clickable: true });
  const off = edit(out, { pagination: "none" });
  assert.equal(off.parameters, undefined);
});

test("only changed fields are written; unknown params survive", () => {
  const cfg = { type: "custom:swipe-card", cards: [{ type: "button" }], parameters: { slidesPerView: "auto", grabCursor: true } };
  const out = edit(cfg, { loop: true });
  assert.deepEqual(out.parameters, { slidesPerView: "auto", grabCursor: true, loop: true });
  assert.deepEqual(Object.keys(out), ["type", "parameters", "cards"]);
});

test("autoplay seconds map to delay ms and back", () => {
  const out = edit({ type: "t", cards: [] }, { autoplay: 5 });
  assert.equal(out.parameters.autoplay.delay, 5000);
  assert.equal(configToForm(out).autoplay, 5);
  assert.equal(edit(out, { autoplay: 0 }).parameters, undefined);
});

test("top-level options set and clear", () => {
  let out = edit({ type: "t", cards: [] }, { start_card: 2, card_width: " 80% ", reset_after: 30 });
  assert.equal(out.start_card, 2);
  assert.equal(out.card_width, "80%");
  assert.equal(out.reset_after, 30);
  out = edit(out, { start_card: null, card_width: "" });
  assert.equal("start_card" in out, false);
  assert.equal("card_width" in out, false);
});

test("advanced YAML edit replaces parameters wholesale", () => {
  const cfg = { type: "t", cards: [], parameters: { loop: true } };
  const prev = configToForm(cfg);
  const out = applyFormChanges(cfg, prev, { ...prev, loop: false, parameters: { speed: 900 } });
  assert.deepEqual(out.parameters, { speed: 900 });
});

test("buildSwiperParams wires elements, start_card and safe defaults", () => {
  const els = { pagination: "P", next: "N", prev: "V", scrollbar: "S" };
  const p = buildSwiperParams({ start_card: 3, parameters: { pagination: null, navigation: null, scrollbar: { hide: true } } }, els);
  assert.equal(p.pagination.el, "P");
  assert.equal(p.navigation.nextEl, "N");
  assert.equal(p.navigation.prevEl, "V");
  assert.deepEqual(p.scrollbar, { hide: true, el: "S" });
  assert.equal(p.initialSlide, 2);
  assert.equal(p.touchStartPreventDefault, false);
  const q = buildSwiperParams({ parameters: { touchStartPreventDefault: true } });
  assert.equal(q.touchStartPreventDefault, true);
});

test("buildSwiperParams does not mutate the config", () => {
  const cfg = { parameters: { pagination: null } };
  buildSwiperParams(cfg, { pagination: "P" });
  assert.equal(cfg.parameters.pagination, null);
});

test("bottomIndicators: strip below for dots and scrollbar, not progress bar or vertical", async () => {
  const { bottomIndicators } = await import("../src/config.js");
  assert.deepEqual(bottomIndicators({ parameters: { pagination: null } }), { pagination: true, scrollbar: false });
  assert.deepEqual(bottomIndicators({ parameters: { pagination: { type: "fraction" }, scrollbar: {} } }), { pagination: true, scrollbar: true });
  assert.equal(bottomIndicators({ parameters: { pagination: { type: "progressbar" } } }).pagination, false);
  assert.equal(bottomIndicators({ parameters: { pagination: null, direction: "vertical" } }).pagination, false);
  assert.equal(bottomIndicators({ pagination_overlay: true, parameters: { pagination: null } }).pagination, false);
  assert.equal(bottomIndicators({}).pagination, false);
});

test("pagination_overlay toggles as a top-level flag", () => {
  const on = edit({ type: "t", cards: [] }, { pagination_overlay: true });
  assert.equal(on.pagination_overlay, true);
  assert.equal("pagination_overlay" in edit(on, { pagination_overlay: false }), false);
});
