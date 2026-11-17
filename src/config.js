// Pure helpers shared by the card and the visual editor.
// Kept free of DOM/Lit imports so they can be unit tested with plain Node.

// Swiper modules that accept `key:` (YAML null) as "enable with defaults".
export const NULLABLE_MODULES = [
  "pagination",
  "navigation",
  "scrollbar",
  "autoplay",
];

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

const enabled = (params, key) =>
  Object.prototype.hasOwnProperty.call(params, key) &&
  params[key] !== false &&
  !(isObject(params[key]) && params[key].enabled === false);

const numOrNull = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : null);

/** Make any user/editor supplied config safe to work with. Never throws. */
export function normalizeConfig(config) {
  const c = isObject(config) ? { ...config } : {};
  c.cards = Array.isArray(c.cards) ? c.cards.filter(isObject) : [];
  if (c.parameters !== undefined && !isObject(c.parameters)) {
    delete c.parameters;
  }
  return c;
}

/** Flatten a card config into the values shown by the editor form. */
export function configToForm(config) {
  const p = isObject(config.parameters) ? config.parameters : {};

  let pagination = "none";
  if (enabled(p, "pagination")) {
    const pg = isObject(p.pagination) ? p.pagination : {};
    if (pg.type === "fraction" || pg.type === "progressbar") {
      pagination = pg.type;
    } else {
      pagination = pg.dynamicBullets ? "dynamic_bullets" : "bullets";
    }
  }

  let autoplay = null;
  if (enabled(p, "autoplay")) {
    const delay = isObject(p.autoplay) ? numOrNull(p.autoplay.delay) : null;
    autoplay = (delay ?? 3000) / 1000;
  }

  return {
    pagination,
    navigation: enabled(p, "navigation"),
    scrollbar: enabled(p, "scrollbar"),
    effect: typeof p.effect === "string" ? p.effect : "slide",
    direction: p.direction === "vertical" ? "vertical" : "horizontal",
    slides_per_view: numOrNull(p.slidesPerView),
    space_between: numOrNull(p.spaceBetween),
    centered_slides: !!p.centeredSlides,
    auto_height: !!p.autoHeight,
    loop: !!p.loop,
    free_mode: enabled(p, "freeMode") && !!p.freeMode,
    autoplay,
    speed: numOrNull(p.speed),
    start_card: numOrNull(config.start_card),
    reset_after: numOrNull(config.reset_after),
    card_width: typeof config.card_width === "string" ? config.card_width : "",
    card_height: typeof config.card_height === "string" ? config.card_height : "",
    parameters: p,
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const setOrDelete = (obj, key, value) => {
  if (value === null || value === undefined || value === "") {
    delete obj[key];
  } else {
    obj[key] = value;
  }
};

const setFlag = (obj, key, on) => {
  if (on) obj[key] = true;
  else delete obj[key];
};

/**
 * Apply only the form fields that changed (prev -> next) onto config.
 * Untouched keys, including Swiper options the form does not know about,
 * are preserved exactly. Editing the Advanced YAML wins over the fields.
 */
export function applyFormChanges(config, prev, next) {
  const out = { ...config };

  if (!same(prev.parameters, next.parameters)) {
    out.parameters = isObject(next.parameters) ? { ...next.parameters } : {};
  } else {
    const p = isObject(out.parameters) ? { ...out.parameters } : {};
    const changed = Object.keys(next).filter(
      (k) => k !== "parameters" && !same(prev[k], next[k])
    );

    for (const key of changed) {
      const v = next[key];
      switch (key) {
        case "pagination": {
          if (v === "none" || !v) {
            delete p.pagination;
            break;
          }
          const pg = isObject(p.pagination) ? { ...p.pagination } : {};
          pg.type = v === "fraction" || v === "progressbar" ? v : "bullets";
          if (v === "dynamic_bullets") pg.dynamicBullets = true;
          else delete pg.dynamicBullets;
          delete pg.enabled;
          if (pg.clickable === undefined) pg.clickable = true;
          p.pagination = pg;
          break;
        }
        case "navigation":
        case "scrollbar":
          if (v) {
            const cur = isObject(p[key]) ? { ...p[key] } : {};
            delete cur.enabled;
            p[key] = cur;
          } else {
            delete p[key];
          }
          break;
        case "effect":
          setOrDelete(p, "effect", v === "slide" ? null : v);
          break;
        case "direction":
          setOrDelete(p, "direction", v === "vertical" ? "vertical" : null);
          break;
        case "slides_per_view":
          setOrDelete(p, "slidesPerView", v);
          break;
        case "space_between":
          setOrDelete(p, "spaceBetween", v);
          break;
        case "speed":
          setOrDelete(p, "speed", v);
          break;
        case "centered_slides":
          setFlag(p, "centeredSlides", v);
          break;
        case "auto_height":
          setFlag(p, "autoHeight", v);
          break;
        case "loop":
          setFlag(p, "loop", v);
          break;
        case "free_mode":
          setFlag(p, "freeMode", v);
          break;
        case "autoplay":
          if (typeof v !== "number" || v <= 0) {
            delete p.autoplay;
          } else {
            const ap = isObject(p.autoplay) ? { ...p.autoplay } : {};
            ap.delay = Math.round(v * 1000);
            delete ap.enabled;
            if (ap.disableOnInteraction === undefined) ap.disableOnInteraction = false;
            if (ap.pauseOnMouseEnter === undefined) ap.pauseOnMouseEnter = true;
            p.autoplay = ap;
          }
          break;
        case "start_card":
        case "reset_after":
          setOrDelete(out, key, typeof v === "number" && v > 0 ? v : null);
          break;
        case "card_width":
        case "card_height":
          setOrDelete(out, key, typeof v === "string" ? v.trim() : null);
          break;
        default:
          break;
      }
    }
    out.parameters = p;
  }

  if (!isObject(out.parameters) || Object.keys(out.parameters).length === 0) {
    delete out.parameters;
  }
  return orderConfig(out);
}

/** Keep YAML readable: type first, options next, cards last. */
export function orderConfig(config) {
  const { type, cards, ...rest } = config;
  return { type, ...rest, cards: cards ?? [] };
}

/**
 * Build the Swiper parameter object for a config.
 * `els` holds the pagination/navigation/scrollbar elements rendered by the card.
 */
export function buildSwiperParams(config, els = {}) {
  let p;
  try {
    p = structuredClone(isObject(config.parameters) ? config.parameters : {});
  } catch (_e) {
    p = { ...(config.parameters || {}) };
  }

  for (const key of NULLABLE_MODULES) {
    if (key in p && (p[key] === null || p[key] === true)) p[key] = {};
  }

  if (enabled(p, "pagination")) {
    p.pagination = { ...p.pagination, el: els.pagination };
  }
  if (enabled(p, "navigation")) {
    p.navigation = { ...p.navigation, nextEl: els.next, prevEl: els.prev };
  }
  if (enabled(p, "scrollbar")) {
    p.scrollbar = { ...p.scrollbar, el: els.scrollbar };
  }

  const start = numOrNull(config.start_card);
  if (start !== null && start >= 1) {
    p.initialSlide = Math.floor(start) - 1;
  }

  // Swiper calls preventDefault() on mousedown unless told not to, which
  // stops dropdowns, text inputs and date pickers inside slides from working.
  if (p.touchStartPreventDefault === undefined) p.touchStartPreventDefault = false;

  return p;
}

export function hasModule(config, key) {
  const p = isObject(config.parameters) ? config.parameters : {};
  return enabled(p, key);
}
