import { SwipeCard } from "./swipe-card.js";
import { SwipeCardEditor } from "./editor.js";
import { CARD_VERSION } from "./const.js";

if (!customElements.get("swipe-card-editor")) {
  customElements.define("swipe-card-editor", SwipeCardEditor);
}
if (!customElements.get("swipe-card")) {
  customElements.define("swipe-card", SwipeCard);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "swipe-card",
    name: "Swipe Card",
    description: "Swipe through multiple cards, with a full visual editor.",
    preview: false,
    documentationURL: "https://github.com/wander00-1/swipe-card",
  });

  console.info(
    `%c  SWIPE-CARD  %c ${CARD_VERSION} `,
    "color: orange; font-weight: bold; background: black",
    "color: white; font-weight: bold; background: dimgray"
  );
}
