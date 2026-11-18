# Changelog

## 6.2.0 - 2026-11-18

### Added

- Mouse wheel option in the editor (Behaviour section). "Sideways only" moves the cards with a trackpad side-swipe or Shift+wheel and leaves normal scrolling to the page. "Any wheel" moves them with the normal wheel too, and hands scrolling back to the page at the first and last card. Off by default.

## 6.1.1 - 2026-11-18

### Fixed

- Click-and-drag with a mouse now swipes even when it starts on an image (or link), instead of dragging the picture. Text no longer gets selected while dragging.

## 6.1.0 - 2026-11-18

### Changed

- The page dots (or numbers) and the scrollbar now sit in a strip below the cards instead of on top of the card content.

### Added

- "Show indicator over the cards" option (`pagination_overlay: true`) to keep the old overlay look.

## 6.0.1 - 2026-11-18

### Fixed

- Cards of different heights now all fill the full height of the swipe card, so a shorter card no longer ends above its neighbours. Cards stay at their natural height when "Resize to the active card" (`autoHeight`) is on.

## 6.0.0 - 2026-11-18

Rewritten for current Home Assistant. Existing YAML configurations keep working.

### Added

- Full visual editor: Swipe options as form fields, plus a tabbed editor for child cards using Home Assistant's own card editors and card picker (upstream #65).
- The editor preview follows the card tab you are editing.
- Child card visibility conditions are respected. Hidden cards drop out of the swiper and pagination (upstream #90).
- Sections dashboard support through `getGridOptions` (upstream #91).
- `card_height` option for fixed height and vertical swiping (upstream #64, #99).
- Release workflow attaches `swipe-card.js` to each GitHub release; CI runs HACS validation, lint, tests and a build check.

### Fixed

- The first card is no longer blank after looping. Swiper 14 moves real cards instead of cloning them (upstream #69).
- `start_card` is honoured reliably (upstream #22, #41).
- Swipe card randomly not loading or showing `t.setConfig is not a function`. Child cards are now created through Home Assistant's `hui-card`, and card helpers are loaded when needed instead of once at startup (upstream #26, #38, #47, #70, #104).
- The broken card rebuild path that showed `unobserve` errors has been removed (upstream #87).
- Ending a swipe no longer triggers a tap on the card underneath (upstream #85, #18, #93).
- Sliders, dropdowns, text inputs and date/time pickers inside cards work again instead of starting a swipe (upstream #10, #45, #97, #103).
- Fraction pagination and the scrollbar follow the theme colours (upstream #17, #66).
- `setConfig` no longer throws on an empty or partial config, which showed a configuration error card on newer Home Assistant versions.
- Reconfiguring the card no longer leaves old Swiper instances running.

### Changed

- Updated to Lit 3 and Swiper 14. Removed `custom-card-helpers` and `deep-clone-simple`.
- Default Swiper `touchStartPreventDefault` is now `false`. Set it back to `true` in `parameters` if you relied on the old behaviour.
- Minimum Home Assistant version is 2024.11.

## 4.0.0

- Drop support for older Home Assistant versions
- Report the correct card size
- Bug fixes

## 3.0.0

- Bundled version
- Updated swiper

## 2.0.1

- Make local possible with `path` option
- Some bug fixes

## 2.0.0

- Convert to LitElement

## 1.0.3

- Initial release that supports versioning
