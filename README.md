# Swipe Card

A Home Assistant dashboard card that lets you swipe through several cards, like pages. It's built on [Swiper](https://swiperjs.com/), so you can also use Swiper's effects and options.

Version 6 is a rewrite for current Home Assistant. Everything can be set up in the visual editor, so you don't need to write YAML.

![Preview](examples/images/preview.gif)

## Installation

### HACS (recommended)

1. In HACS, open the menu (top right) and choose **Custom repositories**.
2. Add `https://github.com/wander00-1/swipe-card` with the type **Dashboard**.
3. Search for **Swipe Card**, install it, then reload your browser.

### Manual

1. Download `swipe-card.js` from the [latest release](https://github.com/wander00-1/swipe-card/releases/latest).
2. Copy it to `/config/www/swipe-card.js`.
3. Go to **Settings > Dashboards > Resources** (top-right menu) and add `/local/swipe-card.js` as a **JavaScript module**.

## Using the visual editor

Edit a dashboard, select **Add card** and pick **Swipe Card**. The editor has five parts:

| Section | What it does |
| --- | --- |
| **Pagination and navigation** | Page indicator (dots, compact dots, numbers or a progress bar), arrows and a scrollbar. |
| **Layout and effect** | Transition effect (slide, fade, cube, coverflow, flip, cards), direction, how many cards show at once, the gap between them, card width and height, centring, and resizing to fit the current card. |
| **Behaviour** | Which card to start on, returning to it after a period of inactivity, auto-advance, transition speed, looping and free scrolling. |
| **Advanced Swiper parameters** | A YAML box for any [Swiper parameter](https://swiperjs.com/swiper-api#parameters). The fields above edit this box too, so you can mix the two. |
| **Cards** | One tab per card, each with that card's own visual editor. Use **+** to add a card, the arrows to reorder, and the copy, cut and delete buttons. Copied cards can be pasted with Home Assistant's normal card picker. |

While you edit, the preview follows the card tab you have selected.

## YAML configuration

Existing YAML from older versions still works unchanged.

```yaml
type: custom:swipe-card
start_card: 1
reset_after: 60
parameters:
  pagination:
    type: bullets
    clickable: true
  navigation: {}
  spaceBetween: 16
cards:
  - type: entities
    entities:
      - light.kitchen
  - type: weather-forecast
    entity: weather.home
```

| Option | Type | Description |
| --- | --- | --- |
| `cards` | list | **Required.** The cards to swipe between. |
| `start_card` | number | The card to show first. `1` is the first card. |
| `reset_after` | number | Seconds of inactivity before returning to `start_card` (or the first card). |
| `card_width` | string | CSS width for each card, such as `80%` or `300px`. Usually paired with `slidesPerView: auto`. |
| `card_height` | string | Fixed height for the card, such as `300px`. Vertical swiping needs this. |
| `parameters` | object | Any [Swiper parameter](https://swiperjs.com/swiper-api#parameters). |

Writing a module name with no value (for example `pagination:`) turns that module on with its default settings, as in earlier versions.

## Examples

Show a peek of the next card:

```yaml
type: custom:swipe-card
card_width: calc(100% - 48px)
parameters:
  slidesPerView: auto
  centeredSlides: true
  spaceBetween: 16
cards: [...]
```

Auto-advance every 5 seconds and loop:

```yaml
type: custom:swipe-card
parameters:
  loop: true
  autoplay:
    delay: 5000
    disableOnInteraction: false
  pagination:
    type: bullets
cards: [...]
```

Coverflow effect:

```yaml
type: custom:swipe-card
parameters:
  effect: coverflow
  slidesPerView: auto
  centeredSlides: true
cards: [...]
```

## Good to know

- **Visibility conditions** on child cards work. A hidden card is removed from the swiper and its page indicator.
- **Sliders, dropdowns, text boxes and date/time pickers** inside a card take the touch instead of starting a swipe. To keep any other element from swiping, give it the class `swiper-no-swiping`.
- **Tapping vs swiping:** the tap that ends a swipe doesn't trigger the card underneath.
- **Sections dashboards:** the card spans the full section width by default and can be resized in the layout tab.
- **Theme colours:** pagination, arrows and scrollbar use your theme's `--primary-color`. To override them, set Swiper's CSS variables (such as `--swiper-pagination-color`) with card-mod or a theme.

## Credits

This card was created by [Bram Kragten](https://github.com/bramkragten/swipe-card). This fork keeps it working with current Home Assistant and adds the visual editor.
