# KEUS Lighting Catalogue

Updated UI accent uses #5b524a / #403a35 / #c6beb6. Product finish colours are not changed.

The All Products control is a custom KEUS-styled dropdown. Product cards retain CSV order; the dropdown remains alphabetical. Each light series card shows its total variant count at the top-right.


## Mobile compact + swipe update

- 4 category tabs are smaller, with smaller icons, tighter spacing and a cleaner pill shape.
- The finish filter section is reduced in height.
- Finish chips and colour circles are smaller.
- Product colour indicators are compact dots.
- On mobile, swiping left/right on a product image changes that product’s finish.
- The corresponding colour dot highlights automatically.
- Only that product’s image and MRP change.
- Detail-page finish chips are slightly smaller.
- `profiles.csv` remains included correctly inside `data/`.


## All colour dots visible on mobile

- Every available product finish dot is shown under the product card.
- No finish dots are hidden behind horizontal scrolling or a `+N` indicator.
- Swiping left/right on the product image changes the finish.
- The matching dot highlights immediately.
- Only that product's image and MRP change.


## Stock code + mobile details fix

- Details page shows one stock code only for the currently selected finish/colour.
- Changing the finish re-renders the selected stock code dynamically.
- If the selected finish has multiple image variants, choosing a thumbnail updates the exact stock code and MRP for that image variant.
- Mobile details layout now prevents page-wide horizontal overflow.
- Product image, finish chips, thumbnails, specification grid and variant table are contained responsively.
- Variant table scrolls inside its own container on mobile.


## Profiles — New Description colour variations

This update is isolated to the `profiles` category. Downlights, Tracklights and Outdoor Lights retain their existing behaviour.

Profile colour/body + diffuser variation is extracted only from `New Description` and mapped to these UI codes:

- WH — White
- GW — Grey & White Diffuser
- CW — Champagne & White Diffuser
- BW — Black & White Diffuser
- IGW — Iron Grey & White Diffuser
- WW — White & White Diffuser
- BB — Black & Black Diffuser
- WB — White & Black Diffuser
- WT — White & Transparent Diffuser
- BT — Black & Transparent Diffuser
- BK — Black

Selecting a variation changes the Profile image using the `Image` value from that same CSV row. The Profile Stock Code, Cutout and description also follow the selected row.

No changes were made to the data schema; `data/profiles.csv` still uses:
`Name, Stock Code, Cutout, New Description, Image`


## Font-size + WebP update

- All existing UI `font-size` values in `index.html` and `light-details.html` are increased by 30%.
- The change is typography-only; product logic, category behaviour, filters and profile variation logic are preserved.
- All four CSV data files now store WebP delivery URLs through `https://wsrv.nl/`.
- The original ImgBB image remains embedded inside each wsrv URL as the source, so the catalogue can continue using the same product artwork while loading WebP.
- `scripts/optimize_csv_images.py` remains included so future raw ImgBB links can be converted to the same WebP format.


## Profile-only exact image mapping

This change is isolated to the Profiles category.

- Every Profile image is selected from the exact CSV row containing that `Stock Code` + `New Description`.
- Profile families are built from the description so naming inconsistencies such as black-finish variants do not split the same profile family.
- Each Profile card exposes all stock-code variants and colour variations available in that family.
- Selecting or swiping a Profile variant updates only that Profile card's image, Stock Code, Cutout and New Description.
- The Profile details page shows every Stock Code / colour combination as a selectable image option.
- WebP is used first. If the WebP delivery URL fails, the page automatically falls back to the original ImgBB source from the same CSV row.
- Downlights, Tracklights and Outdoor Lights keep their existing logic and data unchanged.


## Profile desktop/web refinement

- Only the desktop/web presentation of the Profiles category was refined.
- Profile landing cards now use a cleaner three-column layout.
- Product images are larger.
- Variant/colour controls have a clearer two-column layout.
- The selected variant is easier to identify.
- The Profile details page has a larger visual and cleaner information hierarchy.
- Mobile Profile styling is preserved.
- Downlights, Tracklights and Outdoor Lights are unchanged.


## Desktop/web colour switching

For Downlights, Tracklights and Outdoor Lights on desktop/web:

- Click any finish dot to change that card's colour.
- The active finish dot highlights automatically.
- Previous/next arrows appear subtly when the product card is hovered.
- Horizontal trackpad gestures over the product image switch colours.
- Mouse/pen drag left or right on the product image also switches colours.
- Only the selected product card's image and MRP update.
- Mobile swipe behaviour remains unchanged.
- Profile cards keep their separate Stock Code + New Description variant logic.


## Desktop finish-area cleanup

Only the following desktop/web presentation changes were made:

- Removed visible finish scrollbar.
- Removed visible previous/next colour buttons.
- All finish dots are shown directly and wrap naturally when required.
- Refined `View Details` into a lighter KEUS text CTA with a subtle hover underline.

Everything else remains unchanged, including mobile behaviour, Profile logic, data, filters, image logic and existing interactions.


## Plain finish active/inactive states

- Removed shadows from finish and colour selectors.
- Active state is shown only with a clean `#5b524a` border.
- Inactive states remain plain with no shadow.
- No other page styling or functionality was changed.


## Three requested changes

Only these changes were added:

1. Profile landing page: beside each colour circle, only the colour code is displayed. The Stock Code is no longer shown beside that circle.
2. Mobile View Details: swipe left/right on the main product image to move through available colours/variants.
3. Mobile + Web landing cards: the default displayed product image now automatically highlights its corresponding finish/colour dot.

Everything else is preserved from the previous version.


## Details page Stock Code cleanup

Only one change was made:
- Removed Stock Code from the main lighting-product specification summary on the View Details page.
- Stock Code remains in the Available Variants table.

Everything else is unchanged.
