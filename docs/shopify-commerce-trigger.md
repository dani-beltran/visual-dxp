# Shopify product added to cart

Choose **Commerce: Product added to cart** in a Trigger, then **Shopify**. No element selector is required. Shopify is the default when the platform field is omitted. WooCommerce, PrestaShop, BigCommerce, Adobe Commerce, Ecwid, and Wix eCommerce are disabled premium options. Each option displays its platform brand icon. Hovering does not show a tooltip. The premium explanation remains available by focusing with arrow keys or tapping: **Premium feature - contact the developer**. This text intentionally stays in English in every locale.

Save the trigger as:

```json
{ "event": "commerce-product-added-to-cart", "commercePlatform": "shopify" }
```

An explicit unsupported platform is retained for editing and produces a validation error. It is never replaced automatically. Validation blocks exports and new AI operations, and the runtime rejects unsupported providers even if validation was bypassed. Existing version 1 workflows and the public `run(triggerId?)` API retain their behavior. Manual execution has no storefront event data.

## Store setup

The theme or cart integration must emit Shopify's documented **`shopify:cart:lines-update`** DOM event. Visual DXP listens on the runtime's target document, including inside the preview. It reads `action`, `lines`, and `promise` directly on the event; a `CustomEvent.detail` wrapper does not satisfy the contract.

The integration must supply the operation promise and its actual resulting cart, `userErrors`, and `warnings`. Only `action: "add"` is considered. Visual DXP waits for completion before starting a workflow. Removal, ordinary update, and cart initialization events do not start this trigger.

Shopify documents that its standard `updateCart` action emits cart events. An existing theme's own cart implementation needs to emit the standard event as well. This release does not install Shopify actions, modify a store's cart code, intercept fetch/XMLHttpRequest, or implement theme-specific events. Compatibility depends on the integration; **no observed events alone do not prove incompatibility**. Check that listeners are installed before testing an addition and that the cart integration emits the documented payload. Preview still needs the existing Visual DXP preview bridge and website framing requirements.

Contract verified on October 1, 2026 against [Listen for events](https://shopify.dev/docs/api/storefront-events-and-actions/events/listen) and [Cart lines update](https://shopify.dev/docs/api/storefront-events-and-actions/events/cart-lines-update).

## Success and partial fulfillment

Rejected promises (including aborted or superseded operations), user errors, absent/empty cart quantities, malformed requests/results, and **all warning-bearing results** are skipped. The preview log explains skipped additions. An operation with warnings may have partially succeeded, but this release deliberately does not start a success workflow for it.

The standard result provides neither the prior cart nor a variant-to-cart-line mapping. A positive resulting quantity could be pre-existing stock. Visual DXP therefore never subtracts previously observed cart totals, which would also be unreliable for concurrent additions. With a clean successful mutation, requested quantities are acknowledged as additions; `addition.basis` records this evidence. This is not a measured cart delta. If a requested quantity is unavailable, its confirmed quantity remains `null`.

## Incoming data

The trigger’s **Outputs** section describes its Incoming data. Connect the trigger to **Incoming data** conditions and **Update element → Incoming data** actions. For example, use `addition.totalQuantity` for the acknowledged added count, `requested.lines[0].variantId` for the requested variant, or `cart.totalAmount.amount` for the resulting cart amount. HTTP steps replace incoming data with their own response as usual; sibling paths retain their original input.

Example: two units were requested, and the resulting cart contains nine units:

```json
{
  "platform": "shopify",
  "event": "product-added-to-cart",
  "requested": {
    "lines": [{ "variantId": "gid://shopify/ProductVariant/123", "quantity": 2 }],
    "totalQuantity": 2
  },
  "addition": {
    "basis": "successful-mutation",
    "lines": [{ "variantId": "gid://shopify/ProductVariant/123", "quantity": 2 }],
    "totalQuantity": 2
  },
  "cart": {
    "id": "gid://shopify/Cart/example",
    "totalQuantity": 9,
    "totalAmount": { "amount": "19.90", "currencyCode": "EUR" },
    "lines": [{
      "id": "opaque-cart-line-key",
      "quantity": 9,
      "totalAmount": { "amount": "19.90", "currencyCode": "EUR" }
    }]
  },
  "warnings": []
}
```

Unavailable fields are `null`, including missing cart lines or money. Amount strings and currency codes come from the supplied MoneyV2 values; no monetary amounts, product details, currency conversions, or variant-to-line mappings are inferred. `warnings` is empty for this release's accepted events because warning-bearing outcomes are skipped. The public `CommerceEventData` type defines the shape.

## Lifecycle and verification

Each trigger subscription handles an event object once. Separate event objects, including identical additions, remain separate invocations. Multiple subscribed triggers each run intentionally. Request data is snapshotted before awaiting the promise; invocation data is never held on the shared runtime. Destroying/stopping the runtime removes listeners and prevents pending promises from starting workflows.

The Shopify adapter, subscription entry point, and execution data flow are included in the shared dependency-injected runtime and its standalone serialization. No Shopify SDK or external library is needed in an exported script.

Tests use simulated DOM events and local documents only. They cover direct runtime, isolated preview bridge, standalone exports, ESM/UMD bundle serialization, downstream conditions/actions, missing data, errors/warnings, concurrent/repeated additions, multiple subscriptions, deduplication, cleanup, imports, AI schemas, and accessible premium explanations. They do not certify a real Shopify theme or change a real cart.

Run `npm test`, `npm run typecheck`, `npm run check`, `npm run build:lib`, and `node tests/export-library.mjs`. The companion `dlb-dxp-server` has matching schemas and tests; run its `npm test`, `npm run typecheck`, and `npm run build` when deploying that server.

Verification on October 1, 2026: 182 focused and compatibility tests passed; the companion server's full 162-test suite passed. Typechecking, production and library builds, production smoke tests, and built ESM/UMD standalone checks passed. Changed source files pass Biome checks with no errors. Tests needing HTTP fixtures ran with localhost socket access.

The frontend full-suite run found five existing failures in `ai`, `ai-settings-ui`, `condition-inspector`, `common-presets`, and `export-ui` tests. The repository-wide Biome check found seven existing formatting/import-order errors. Both sets were reproduced in a temporary checkout of unchanged `HEAD`; they are not commerce regressions.


Brand icons are bundled SVG silhouettes: [Simple Icons 16.0.0](https://github.com/simple-icons/simple-icons/tree/16.0.0/icons) for Shopify, WooCommerce, PrestaShop, BigCommerce, and Wix; [Simple Icons 11.15.0](https://github.com/simple-icons/simple-icons/blob/11.15.0/icons/adobe.svg) for Adobe; and the symbol from [Ecwid’s website](https://www.ecwid.com/). Adobe Commerce uses the Adobe mark, consistent with [Adobe’s Experience Cloud branding guidance](https://experienceleague.adobe.com/docs/authoring-guide/assets/adobe_experience_cloud_guidelines.pdf?lang=en). Icons load locally with the builder, with no external image requests.
