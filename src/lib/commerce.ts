/** Normalized commerce input. Null means the storefront did not supply the value. */
export interface CommerceEventData {
  platform: 'shopify';
  event: 'product-added-to-cart';
  requested: {
    lines: { variantId: string; quantity: number | null }[];
    totalQuantity: number | null;
  };
  addition: {
    /** A successful mutation acknowledgement, not a before/after cart delta. */
    basis: 'successful-mutation';
    lines: { variantId: string; quantity: number | null }[];
    totalQuantity: number | null;
  };
  cart: {
    id: string | null;
    totalQuantity: number | null;
    totalAmount: CommerceMoney | null;
    /** Cart line IDs are not variant IDs; Shopify does not supply that mapping. */
    lines:
      | { id: string | null; quantity: number | null; totalAmount: CommerceMoney | null }[]
      | null;
  };
  warnings: { code: string | null; message: string | null; target: string | null }[];
}

export interface CommerceMoney {
  amount: string | null;
  currencyCode: string | null;
}
