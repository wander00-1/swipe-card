import { LitElement, html, css, nothing } from "lit";
import { keyed } from "lit/directives/keyed.js";
import {
  mdiArrowLeft,
  mdiArrowRight,
  mdiCodeBraces,
  mdiCodeJson,
  mdiCogOutline,
  mdiContentCopy,
  mdiContentCut,
  mdiDelete,
  mdiGestureSwipeHorizontal,
  mdiListBoxOutline,
  mdiPageLayoutBody,
  mdiPlus,
} from "@mdi/js";

import {
  applyFormChanges,
  configToForm,
  normalizeConfig,
  orderConfig,
} from "./config.js";
import { setLastEditorSelection } from "./const.js";

const SCHEMA = [
  {
    name: "nav_section",
    type: "expandable",
    flatten: true,
    expanded: true,
    title: "Pagination and navigation",
    iconPath: mdiGestureSwipeHorizontal,
    schema: [
      {
        name: "pagination",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "none", label: "None" },
              { value: "bullets", label: "Dots" },
              { value: "dynamic_bullets", label: "Dots (compact, for many cards)" },
              { value: "fraction", label: "Numbers (2 / 5)" },
              { value: "progressbar", label: "Progress bar" },
            ],
          },
        },
      },
      {
        name: "",
        type: "grid",
        schema: [
          { name: "navigation", selector: { boolean: {} } },
          { name: "scrollbar", selector: { boolean: {} } },
          { name: "pagination_overlay", selector: { boolean: {} } },
        ],
      },
    ],
  },
  {
    name: "layout_section",
    type: "expandable",
    flatten: true,
    title: "Layout and effect",
    iconPath: mdiPageLayoutBody,
    schema: [
      {
        name: "",
        type: "grid",
        schema: [
          {
            name: "effect",
            selector: {
              select: {
                mode: "dropdown",
                options: [
                  { value: "slide", label: "Slide" },
                  { value: "fade", label: "Fade" },
                  { value: "cube", label: "Cube" },
                  { value: "coverflow", label: "Coverflow" },
                  { value: "flip", label: "Flip" },
                  { value: "cards", label: "Cards" },
                ],
              },
            },
          },
          {
            name: "direction",
            selector: {
              select: {
                mode: "dropdown",
                options: [
                  { value: "horizontal", label: "Horizontal" },
                  { value: "vertical", label: "Vertical" },
                ],
              },
            },
          },
          {
            name: "slides_per_view",
            selector: { number: { min: 1, max: 10, step: 0.1, mode: "box" } },
          },
          {
            name: "space_between",
            selector: {
              number: { min: 0, max: 100, step: 1, mode: "box", unit_of_measurement: "px" },
            },
          },
          { name: "card_width", selector: { text: {} } },
          { name: "card_height", selector: { text: {} } },
          { name: "centered_slides", selector: { boolean: {} } },
          { name: "auto_height", selector: { boolean: {} } },
        ],
      },
    ],
  },
  {
    name: "behaviour_section",
    type: "expandable",
    flatten: true,
    title: "Behaviour",
    iconPath: mdiCogOutline,
    schema: [
      {
        name: "",
        type: "grid",
        schema: [
          {
            name: "start_card",
            selector: { number: { min: 1, max: 50, step: 1, mode: "box" } },
          },
          {
            name: "reset_after",
            selector: {
              number: { min: 0, max: 3600, step: 1, mode: "box", unit_of_measurement: "s" },
            },
          },
          {
            name: "autoplay",
            selector: {
              number: { min: 0, max: 600, step: 0.5, mode: "box", unit_of_measurement: "s" },
            },
          },
          {
            name: "speed",
            selector: {
              number: { min: 0, max: 5000, step: 50, mode: "box", unit_of_measurement: "ms" },
            },
          },
          { name: "loop", selector: { boolean: {} } },
          { name: "free_mode", selector: { boolean: {} } },
        ],
      },
    ],
  },
  {
    name: "advanced_section",
    type: "expandable",
    flatten: true,
    title: "Advanced Swiper parameters",
    iconPath: mdiCodeJson,
    schema: [{ name: "parameters", selector: { object: {} } }],
  },
];

const LABELS = {
  pagination: "Page indicator",
  navigation: "Show arrows",
  scrollbar: "Show scrollbar",
  pagination_overlay: "Show indicator over the cards",
  effect: "Transition effect",
  direction: "Swipe direction",
  slides_per_view: "Cards visible at once",
  space_between: "Gap between cards",
  card_width: "Card width",
  card_height: "Card height",
  centered_slides: "Centre the active card",
  auto_height: "Resize to the active card",
  start_card: "Start on card",
  reset_after: "Return to start card after",
  autoplay: "Auto-advance every",
  speed: "Transition speed",
  loop: "Loop around",
  free_mode: "Free scrolling (no snapping)",
  parameters: "Swiper parameters (YAML)",
};

const HELPERS = {
  pagination_overlay: "Off: dots and scrollbar sit in a strip below the cards.",
  slides_per_view: "Leave empty for one card at a time.",
  card_width: "CSS width per card, e.g. 80% or 300px. Pair with 'slidesPerView: auto' in Advanced.",
  card_height: "Fixed height, e.g. 300px. Needed for vertical swiping.",
  start_card: "Card number shown first (1 is the first card).",
  reset_after: "Seconds of inactivity. Leave empty to stay where you are.",
  autoplay: "Seconds per card. Leave empty or 0 to turn off.",
  parameters:
    "Any option from swiperjs.com/swiper-api#parameters. Values here are what the fields above edit.",
};

const CLIPBOARD_KEY = "dashboardCardClipboard";

// HA only loads its card editor and card picker elements when a built-in
// stack card editor is opened. Load them the same way so our editor can use
// them. Resolves to true when they are available.
let editorElementsPromise;
const loadEditorElements = () => {
  const ready = () =>
    !!customElements.get("hui-card-element-editor") &&
    !!customElements.get("hui-card-picker");
  if (ready()) return Promise.resolve(true);
  if (!editorElementsPromise) {
    const load = (async () => {
      try {
        const helpers = await window.loadCardHelpers?.();
        if (!customElements.get("hui-vertical-stack-card")) {
          helpers?.createCardElement({ type: "vertical-stack", cards: [] });
        }
        await customElements.whenDefined("hui-vertical-stack-card");
        await customElements.get("hui-vertical-stack-card").getConfigElement();
      } catch (e) {
        console.warn("swipe-card: could not load HA card editors", e);
      }
      return ready();
    })();
    const timeout = new Promise((resolve) => setTimeout(() => resolve(ready()), 8000));
    editorElementsPromise = Promise.race([load, timeout]);
  }
  return editorElementsPromise;
};

export class SwipeCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { attribute: false },
      lovelace: { attribute: false },
      _config: { state: true },
      _selected: { state: true },
      _guiMode: { state: true },
      _guiModeAvailable: { state: true },
      _editorsReady: { state: true },
    };
  }

  constructor() {
    super();
    this._selected = 0;
    this._guiMode = true;
    this._guiModeAvailable = true;
    this._editorsReady = undefined;
    this._keys = new Map();
  }

  setConfig(config) {
    this._config = orderConfig(normalizeConfig(config));
    if (this._selected > this._config.cards.length) {
      this._selected = this._config.cards.length;
    }
  }

  connectedCallback() {
    super.connectedCallback();
    if (this._editorsReady === undefined) {
      loadEditorElements().then((ok) => {
        this._editorsReady = ok;
      });
    }
  }

  render() {
    if (!this.hass || !this._config) return nothing;
    this._formData = configToForm(this._config);
    const cards = this._config.cards;
    const selected = this._selected;

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._formData}
        .schema=${SCHEMA}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._formChanged}
      ></ha-form>

      <div class="cards">
        <div class="cards-header">Cards</div>
        <div class="toolbar">
          <div class="tabs" role="tablist">
            ${cards.map(
              (card, i) => html`<button
                class="tab ${i === selected ? "active" : ""}"
                role="tab"
                aria-selected=${i === selected}
                title=${card.type ?? ""}
                @click=${() => this._select(i)}
              >
                ${i + 1}
              </button>`
            )}
          </div>
          <ha-icon-button
            class=${selected >= cards.length ? "active" : ""}
            .path=${mdiPlus}
            .label=${"Add card"}
            @click=${this._addCard}
          ></ha-icon-button>
        </div>

        <div id="editor">${this._renderEditorBody(cards, selected)}</div>
      </div>
    `;
  }

  _renderEditorBody(cards, selected) {
    if (this._editorsReady === undefined) {
      return html`<div class="note">Loading card editors...</div>`;
    }
    if (this._editorsReady === false) {
      return html`<div class="note">
        Home Assistant's card editors could not be loaded. You can still edit
        the child cards with the code editor (the "Show code editor" option in
        this dialog's menu).
      </div>`;
    }

    if (selected >= cards.length) {
      return html`<hui-card-picker
        .hass=${this.hass}
        .lovelace=${this.lovelace}
        @config-changed=${this._cardPicked}
      ></hui-card-picker>`;
    }

    const loc = (key, fallback) =>
      this.hass.localize?.(`ui.panel.lovelace.editor.edit_card.${key}`) || fallback;

    return html`
      <div class="card-options">
        <ha-icon-button
          class="gui-mode-button"
          .disabled=${!this._guiModeAvailable}
          .label=${this._guiMode
            ? loc("show_code_editor", "Show code editor")
            : loc("show_visual_editor", "Show visual editor")}
          .path=${this._guiMode ? mdiCodeBraces : mdiListBoxOutline}
          @click=${this._toggleMode}
        ></ha-icon-button>
        <ha-icon-button
          .disabled=${selected === 0}
          .label=${loc("move_before", "Move before")}
          .path=${mdiArrowLeft}
          @click=${() => this._move(-1)}
        ></ha-icon-button>
        <ha-icon-button
          .disabled=${selected === cards.length - 1}
          .label=${loc("move_after", "Move after")}
          .path=${mdiArrowRight}
          @click=${() => this._move(1)}
        ></ha-icon-button>
        <ha-icon-button
          .label=${loc("copy", "Copy")}
          .path=${mdiContentCopy}
          @click=${this._copyCard}
        ></ha-icon-button>
        <ha-icon-button
          .label=${loc("cut", "Cut")}
          .path=${mdiContentCut}
          @click=${this._cutCard}
        ></ha-icon-button>
        <ha-icon-button
          .label=${loc("delete", "Delete")}
          .path=${mdiDelete}
          @click=${this._deleteCard}
        ></ha-icon-button>
      </div>
      ${keyed(
        this._key(selected, cards.length),
        html`<hui-card-element-editor
          .hass=${this.hass}
          .lovelace=${this.lovelace}
          .value=${cards[selected]}
          @config-changed=${this._cardChanged}
          @GUImode-changed=${this._guiModeChanged}
        ></hui-card-element-editor>`
      )}
    `;
  }

  // ---- Swipe options form --------------------------------------------------

  _computeLabel = (schema) => LABELS[schema.name] ?? schema.title ?? schema.name;

  _computeHelper = (schema) => HELPERS[schema.name];

  _formChanged(ev) {
    ev.stopPropagation();
    if (!this._config || ev.target !== ev.currentTarget) return;
    const next = ev.detail.value;
    this._commit(applyFormChanges(this._config, this._formData, next));
  }

  // ---- Child cards ---------------------------------------------------------

  _key(index, length) {
    const k = `${index}-${length}`;
    if (!this._keys.has(k)) this._keys.set(k, Math.random().toString(36));
    return this._keys.get(k);
  }

  _select(index) {
    this._selected = index;
    this._guiMode = true;
    this._guiModeAvailable = true;
    setLastEditorSelection(index);
  }

  _addCard() {
    this._selected = this._config.cards.length;
  }

  _cardPicked(ev) {
    ev.stopPropagation();
    const card = ev.detail.config;
    if (!card) return;
    const cards = [...this._config.cards, card];
    this._keys.clear();
    this._commit({ ...this._config, cards });
    this._select(cards.length - 1);
  }

  _cardChanged(ev) {
    ev.stopPropagation();
    const card = ev.detail.config;
    if (!card) return;
    const cards = [...this._config.cards];
    cards[this._selected] = card;
    this._guiModeAvailable = ev.detail.guiModeAvailable ?? true;
    this._commit({ ...this._config, cards });
  }

  _guiModeChanged(ev) {
    ev.stopPropagation();
    this._guiMode = ev.detail.guiMode;
    this._guiModeAvailable = ev.detail.guiModeAvailable;
  }

  _toggleMode() {
    this.renderRoot.querySelector("hui-card-element-editor")?.toggleMode();
  }

  _move(delta) {
    const from = this._selected;
    const to = from + delta;
    const cards = [...this._config.cards];
    if (to < 0 || to >= cards.length) return;
    const [card] = cards.splice(from, 1);
    cards.splice(to, 0, card);
    this._keys.clear();
    this._commit({ ...this._config, cards });
    this._select(to);
  }

  _copyCard() {
    const card = this._config.cards[this._selected];
    if (!card) return;
    try {
      // Same key HA's own editors use, so "paste" in the card picker works.
      sessionStorage.setItem(CLIPBOARD_KEY, JSON.stringify(card));
    } catch (_e) {
      // Storage can be unavailable (private mode); copying is best effort.
    }
  }

  _cutCard() {
    this._copyCard();
    this._deleteCard();
  }

  _deleteCard() {
    const cards = [...this._config.cards];
    cards.splice(this._selected, 1);
    this._keys.clear();
    this._commit({ ...this._config, cards });
    this._select(Math.max(0, this._selected - 1));
  }

  _commit(config) {
    this._config = orderConfig(config);
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }
      ha-form {
        display: block;
        margin-bottom: 24px;
      }
      .cards-header {
        font-size: 16px;
        font-weight: 500;
        margin-bottom: 8px;
      }
      .toolbar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .tabs {
        display: flex;
        flex: 1;
        gap: 4px;
        overflow-x: auto;
        min-width: 0;
      }
      .tab {
        min-width: 40px;
        height: 36px;
        padding: 0 12px;
        border: 1px solid var(--divider-color);
        border-radius: 18px;
        background: none;
        color: var(--primary-text-color);
        font: inherit;
        cursor: pointer;
      }
      .tab:hover {
        background: var(--secondary-background-color);
      }
      .tab.active {
        background: var(--primary-color);
        border-color: var(--primary-color);
        color: var(--text-primary-color, #fff);
      }
      ha-icon-button.active {
        color: var(--primary-color);
      }
      #editor {
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        padding: 12px;
      }
      @media (max-width: 450px) {
        #editor {
          margin: 0 -12px;
        }
      }
      .card-options {
        display: flex;
        justify-content: flex-end;
        width: 100%;
      }
      .gui-mode-button {
        margin-inline-end: auto;
      }
      .note {
        color: var(--secondary-text-color);
        padding: 8px;
      }
    `;
  }
}
