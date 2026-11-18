export const CARD_VERSION = "6.2.0";

// The editor and the preview card live in the same document; this window
// event lets the preview follow whichever child card tab is being edited.
export const EDITOR_SELECT_EVENT = "swipe-card-editor-select";

let lastSelection = null;

export const setLastEditorSelection = (index) => {
  lastSelection = index;
  window.dispatchEvent(
    new CustomEvent(EDITOR_SELECT_EVENT, { detail: { index } })
  );
};

export const getLastEditorSelection = () => lastSelection;
