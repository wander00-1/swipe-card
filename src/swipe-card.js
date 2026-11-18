import { LitElement, html, css, unsafeCSS, nothing } from "lit";
import { classMap } from "lit/directives/class-map.js";
import Swiper from "swiper/bundle";
import swiperStyle from "swiper/swiper-bundle.css";

import {
  bottomIndicators,
  buildSwiperParams,
  hasModule,
  normalizeConfig,
} from "./config.js";
import { EDITOR_SELECT_EVENT, getLastEditorSelection } from "./const.js";

// Anything matching this inside a slide gets the pointer to itself instead of
// starting a swipe: sliders, dropdowns, text/date/time inputs and so on.
const INTERACTIVE_SELECTOR = [
  "input",
  "select",
  "textarea",
  "[contenteditable]",
  "ha-slider",
  "ha-control-slider",
  "ha-control-circular-slider",
  "ha-control-number-buttons",
  "ha-select",
  "ha-textfield",
  "ha-combo-box",
  "ha-date-input",
  "ha-time-input",
  "ha-base-time-input",
  "ha-selector",
  "mwc-select",
  "md-slider",
  "round-slider",
  ".swiper-no-swiping",
  "[data-no-swipe]",
].join(",");

const computeCardSize = async (card) => {
  if (!card) return 1;
  if (typeof card.getCardSize === "function") {
    try {
      return (await card.getCardSize()) ?? 1;
    } catch (_e) {
      return 1;
    }
  }
  return 1;
};

const computeRTL = (hass) => {
  if (!hass) return false;
  const lang = hass.selectedLanguage || hass.language;
  return !!hass.translationMetadata?.translations?.[lang]?.isRTL;
};

let helpersPromise;
const loadHelpers = () => {
  if (!helpersPromise && window.loadCardHelpers) {
    helpersPromise = window.loadCardHelpers();
  }
  return helpersPromise;
};

export class SwipeCard extends LitElement {
  static get properties() {
    return {
      _config: { state: true },
      _rtl: { state: true },
    };
  }

  static async getConfigElement() {
    await customElements.whenDefined("swipe-card-editor");
    return document.createElement("swipe-card-editor");
  }

  static getStubConfig() {
    return {
      parameters: { pagination: { type: "bullets", clickable: true } },
      cards: [],
    };
  }

  constructor() {
    super();
    this._slides = [];
    this._preview = false;
    this._rtl = false;
    this._needsInit = false;
    this._onEditorSelect = this._onEditorSelect.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onClickCapture = this._onClickCapture.bind(this);
    this._onDragStart = this._onDragStart.bind(this);
    this._ro = window.ResizeObserver
      ? new ResizeObserver(() => this._scheduleUpdate())
      : undefined;
  }

  // ---- Lovelace card API -------------------------------------------------

  setConfig(config) {
    // Never throw here: HA shows a hard error card if setConfig throws.
    // Child cards are reused where their config is unchanged; Swiper itself is
    // cheap to rebuild, so it is always restarted with the new parameters.
    const next = normalizeConfig(config);
    this._config = next;
    this._syncSlides(next.cards);
    this._needsInit = true;
    this.requestUpdate();
  }

  set hass(hass) {
    this._hass = hass;
    for (const slide of this._slides) {
      if (slide.card) {
        try {
          slide.card.hass = hass;
        } catch (e) {
          console.error("swipe-card: child card rejected hass", e);
        }
      }
    }
    const rtl = computeRTL(hass);
    if (rtl !== this._rtl) {
      this._rtl = rtl;
      this._needsInit = true;
    }
  }

  get hass() {
    return this._hass;
  }

  set preview(value) {
    const v = !!value;
    if (v === this._preview) return;
    this._preview = v;
    for (const slide of this._slides) {
      if (slide.card && "preview" in slide.card) slide.card.preview = v;
    }
    this.requestUpdate();
  }

  get preview() {
    return this._preview;
  }

  // Older HA versions set editMode instead of preview.
  set editMode(value) {
    this.preview = value;
  }

  async getCardSize() {
    const visible = this._slides.filter((s) => s.visible);
    if (!visible.length) return 1;
    const sizes = await Promise.all(visible.map((s) => computeCardSize(s.card)));
    return Math.max(1, ...sizes);
  }

  // Sections view: default to the full section width, like the stack cards.
  getGridOptions() {
    return { columns: 12, min_columns: 3 };
  }

  // ---- Lifecycle -----------------------------------------------------------

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener(EDITOR_SELECT_EVENT, this._onEditorSelect);
    if (this._swiper) {
      this._scheduleUpdate();
      this._armResetTimer();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener(EDITOR_SELECT_EVENT, this._onEditorSelect);
    this._clearResetTimer();
  }

  firstUpdated() {
    const container = this._container;
    container.addEventListener("pointerdown", this._onPointerDown, true);
    container.addEventListener("click", this._onClickCapture, true);
    container.addEventListener("dragstart", this._onDragStart, true);
  }

  updated(changed) {
    super.updated(changed);
    if (this._needsInit && this._config) {
      this._initSwiper();
    }
  }

  get _container() {
    return this.renderRoot?.querySelector(".swiper");
  }

  // ---- Rendering -----------------------------------------------------------

  render() {
    if (!this._config) return nothing;
    const c = this._config;
    const empty = c.cards.length === 0;
    const below = bottomIndicators(c);
    // classMap leaves the classes Swiper adds to this element alone.
    const classes = classMap({
      swiper: true,
      "pagination-below": below.pagination,
      "scrollbar-below": below.scrollbar,
    });
    return html`
      ${empty && this._preview
        ? html`<div class="placeholder">
            Add cards to this swipe card in the editor.
          </div>`
        : nothing}
      <div
        class=${classes}
        dir=${this._rtl ? "rtl" : "ltr"}
        style=${c.card_height ? `height:${c.card_height}` : ""}
        ?hidden=${empty}
      >
        <div class="swiper-wrapper"></div>
        ${hasModule(c, "pagination") ? html`<div class="swiper-pagination"></div>` : nothing}
        ${hasModule(c, "navigation")
          ? html`<div class="swiper-button-prev"></div>
              <div class="swiper-button-next"></div>`
          : nothing}
        ${hasModule(c, "scrollbar") ? html`<div class="swiper-scrollbar"></div>` : nothing}
      </div>
    `;
  }

  // ---- Slides --------------------------------------------------------------

  _syncSlides(cardConfigs) {
    const useHuiCard = !!customElements.get("hui-card");
    cardConfigs.forEach((cfg, i) => {
      const existing = this._slides[i];
      if (existing && existing.kind === "hui" && useHuiCard) {
        if (JSON.stringify(existing.config) !== JSON.stringify(cfg)) {
          existing.config = cfg;
          existing.card.config = cfg;
        }
        return;
      }
      if (existing && existing.kind === "legacy" &&
          JSON.stringify(existing.config) === JSON.stringify(cfg)) {
        return;
      }
      if (existing) this._disposeSlide(existing);
      this._slides[i] = this._createSlide(cfg, useHuiCard);
    });
    for (const extra of this._slides.splice(cardConfigs.length)) {
      this._disposeSlide(extra);
    }
  }

  _createSlide(cfg, useHuiCard) {
    const el = document.createElement("div");
    el.className = "swiper-slide";
    const slide = { el, config: cfg, card: undefined, visible: true, kind: useHuiCard ? "hui" : "legacy" };

    if (useHuiCard) {
      // hui-card is what HA's own stacks use. It handles per-card visibility
      // conditions, error cards, custom cards that load late, and rebuilds.
      const card = document.createElement("hui-card");
      card.preview = this._preview;
      card.config = cfg;
      if (this._hass) card.hass = this._hass;
      card.addEventListener("card-visibility-changed", (ev) => {
        if (ev.target !== card) return;
        ev.stopPropagation();
        this._setSlideVisible(slide, !card.hidden);
      });
      card.load();
      el.appendChild(card);
      slide.card = card;
      slide.visible = !card.hidden;
    } else {
      this._loadLegacyCard(slide, cfg);
    }

    this._ro?.observe(el);
    return slide;
  }

  async _loadLegacyCard(slide, cfg) {
    const helpers = await loadHelpers();
    if (!helpers || !this._slides.includes(slide)) return;
    const card = helpers.createCardElement(cfg);
    if (this._hass) card.hass = this._hass;
    if ("preview" in card || this._preview) card.preview = this._preview;
    card.addEventListener(
      "ll-rebuild",
      (ev) => {
        ev.stopPropagation();
        if (!this._slides.includes(slide)) return;
        slide.el.replaceChildren();
        this._loadLegacyCard(slide, cfg);
      },
      { once: true }
    );
    slide.el.replaceChildren(card);
    slide.card = card;
    this._scheduleUpdate();
  }

  _disposeSlide(slide) {
    this._ro?.unobserve(slide.el);
    slide.el.remove();
  }

  _setSlideVisible(slide, visible) {
    if (slide.visible === visible) return;
    slide.visible = visible;
    this._applySlideStyle(slide);
    if (this._swiper && !this._swiper.destroyed) {
      // Loop mode tracks slide order internally, so rebuild in that case.
      if (this._swiper.params.loop) this._needsInit = true;
      this.requestUpdate();
      this._scheduleUpdate();
    }
  }

  _applySlideStyle(slide) {
    const el = slide.el;
    el.classList.toggle("swiper-slide", slide.visible);
    el.style.display = slide.visible ? "" : "none";
    el.style.width = this._config?.card_width && slide.visible ? this._config.card_width : "";
  }

  // ---- Swiper --------------------------------------------------------------

  _initSwiper() {
    const container = this._container;
    if (!container) return;
    this._needsInit = false;

    let keepIndex = null;
    if (this._swiper && !this._swiper.destroyed) {
      if (this._preview) keepIndex = this._swiper.realIndex;
      this._swiper.destroy(true, true);
    }
    this._swiper = undefined;
    this._clearResetTimer();

    const wrapper = container.querySelector(".swiper-wrapper");
    wrapper.replaceChildren(...this._slides.map((s) => s.el));
    this._slides.forEach((s) => this._applySlideStyle(s));

    if (!this._slides.length) return;

    const params = buildSwiperParams(this._config, {
      pagination: container.querySelector(".swiper-pagination"),
      next: container.querySelector(".swiper-button-next"),
      prev: container.querySelector(".swiper-button-prev"),
      scrollbar: container.querySelector(".swiper-scrollbar"),
    });

    if (this._preview) {
      const sel = keepIndex ?? getLastEditorSelection();
      if (sel !== null && sel !== undefined && sel < this._slides.length) {
        params.initialSlide = sel;
      }
    }

    try {
      this._swiper = new Swiper(container, params);
    } catch (e) {
      console.error("swipe-card: could not start Swiper with these parameters", e);
      return;
    }

    this._swiper.on("sliderMove", (_s, e) => {
      this._dragged = true;
      // A mouse drag would otherwise select the card text it passes over.
      if (e?.pointerType === "mouse") window.getSelection()?.removeAllRanges();
    });
    this._swiper.on("touchStart", () => {
      this._dragged = false;
    });

    if (this._config.reset_after) {
      const arm = () => this._armResetTimer();
      this._swiper.on("slideChange", arm).on("touchEnd", arm).on("click", arm);
    }
  }

  _scheduleUpdate() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = undefined;
      if (this._swiper && !this._swiper.destroyed) this._swiper.update();
    });
  }

  _slideTo(index, speed) {
    const s = this._swiper;
    if (!s || s.destroyed) return;
    if (s.params.loop) s.slideToLoop(index, speed);
    else s.slideTo(index, speed);
  }

  _armResetTimer() {
    this._clearResetTimer();
    const secs = Number(this._config?.reset_after);
    if (!secs || secs <= 0 || !this._swiper) return;
    this._resetTimer = window.setTimeout(() => {
      const start = Number(this._config.start_card);
      this._slideTo(start >= 1 ? start - 1 : 0);
    }, secs * 1000);
  }

  _clearResetTimer() {
    if (this._resetTimer) {
      window.clearTimeout(this._resetTimer);
      this._resetTimer = undefined;
    }
  }

  // ---- Input handling ------------------------------------------------------

  // Let sliders, dropdowns and inputs inside slides work instead of swiping.
  _onPointerDown(ev) {
    const swiper = this._swiper;
    if (!swiper || swiper.destroyed) return;
    const container = this._container;
    const path = ev.composedPath();
    let interactive = false;
    for (const node of path) {
      if (node === container) break;
      if (node instanceof Element && node.matches(INTERACTIVE_SELECTOR)) {
        interactive = true;
        break;
      }
    }
    if (!interactive) return;

    const restoreTo = this._config?.parameters?.allowTouchMove ?? true;
    swiper.allowTouchMove = false;
    const restore = () => {
      window.removeEventListener("pointerup", restore, true);
      window.removeEventListener("pointercancel", restore, true);
      if (!swiper.destroyed) swiper.allowTouchMove = restoreTo;
    };
    window.addEventListener("pointerup", restore, true);
    window.addEventListener("pointercancel", restore, true);
  }

  // Browsers start a native "drag this picture/link" on mouse drag, which
  // steals the pointer from Swiper. Cancel it so the drag swipes instead.
  // Elements that opt in with draggable="true" keep native drag and drop.
  _onDragStart(ev) {
    const container = this._container;
    for (const node of ev.composedPath()) {
      if (node === container) break;
      if (node instanceof Element && node.getAttribute("draggable") === "true") {
        return;
      }
    }
    ev.preventDefault();
  }

  // Swallow the click that ends a drag so it does not trigger tap actions
  // on the card underneath the pointer.
  _onClickCapture(ev) {
    if (this._dragged) {
      ev.stopPropagation();
      ev.preventDefault();
      this._dragged = false;
    }
  }

  // In the editor preview, follow the card tab selected in the editor.
  _onEditorSelect(ev) {
    if (!this._preview) return;
    const index = ev.detail?.index;
    if (typeof index === "number" && index < this._slides.length) {
      this._slideTo(index);
    }
  }

  static get styles() {
    return css`
      :host {
        display: block;
        --swiper-theme-color: var(--primary-color);
        --swiper-navigation-color: var(--primary-color);
        --swiper-pagination-color: var(--primary-color);
        --swiper-pagination-bullet-inactive-color: var(--primary-text-color);
        --swiper-pagination-fraction-color: var(--primary-text-color);
        --swiper-pagination-progressbar-bg-color: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.15);
        --swiper-scrollbar-bg-color: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.15);
        --swiper-scrollbar-drag-bg-color: var(--primary-color);
      }
      ${unsafeCSS(swiperStyle)}
      .swiper[hidden] {
        display: none;
      }
      /* Reserve a strip under the cards for the dots/numbers and scrollbar
         so they don't sit on top of the card content. */
      .swiper.pagination-below {
        padding-bottom: 24px;
      }
      .swiper.scrollbar-below {
        padding-bottom: 16px;
      }
      .swiper.pagination-below.scrollbar-below {
        padding-bottom: 36px;
      }
      .swiper.pagination-below > .swiper-pagination {
        bottom: 4px;
      }
      .swiper.pagination-below.scrollbar-below > .swiper-pagination {
        bottom: 14px;
      }
      .swiper.scrollbar-below > .swiper-scrollbar {
        bottom: 4px;
      }
      .swiper-slide {
        height: auto;
        box-sizing: border-box;
      }
      /* Slides stretch to the tallest card; pass that height down to the
         card element so cards with ha-card { height: 100% } fill it. */
      .swiper-slide > *,
      .swiper-slide > hui-card > * {
        display: block;
        height: 100%;
      }
      .placeholder {
        padding: 16px;
        border: 1px dashed var(--divider-color);
        border-radius: var(--ha-card-border-radius, 12px);
        color: var(--secondary-text-color);
        text-align: center;
      }
    `;
  }
}
