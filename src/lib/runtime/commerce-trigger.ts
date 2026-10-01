import type { CommerceEventData } from '../commerce';
import type { StepConfig } from '../types';
import type { RuntimeContext } from './context';
import type { RunTrigger } from './execution';

/** Adapter boundary: subscribe once per trigger, emit only established additions. */
export interface CommerceAdapter {
  subscribe(
    doc: Document,
    onAddition: (data: CommerceEventData) => void,
    onIgnored: (message: string) => void,
  ): () => void;
}

// Self-contained factory: serialized into standalone exports via runtimeModules.
export function createShopifyAdapter(): CommerceAdapter {
  return {
    subscribe(doc, onAddition, onIgnored) {
      let active = true;
      const seen = new WeakSet<Event>();
      const object = (value: unknown): Record<string, unknown> | null =>
        value !== null && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : null;
      const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);
      const quantity = (value: unknown) =>
        typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
      const money = (cost: unknown) => {
        const amount = object(object(cost)?.totalAmount);
        return amount
          ? { amount: text(amount.amount), currencyCode: text(amount.currencyCode) }
          : null;
      };
      const ignore = (message: string) => {
        if (active) onIgnored(message);
      };
      async function observe(event: Event): Promise<void> {
        // Shopify payload properties live on the Event itself, not CustomEvent.detail.
        const incoming = event as Event & { action?: unknown; lines?: unknown; promise?: unknown };
        if (!active || incoming.action !== 'add' || seen.has(event)) return;
        seen.add(event);
        const promise = incoming.promise as Promise<unknown> | undefined;
        if (!promise || typeof promise.then !== 'function') {
          ignore('Shopify addition ignored: missing operation promise.');
          return;
        }
        // Snapshot requests before awaiting; the source must not mutate this invocation.
        const lines = Array.isArray(incoming.lines)
          ? incoming.lines.map((line) => {
              const value = object(line);
              const variant = value?.merchandiseId;
              return {
                variantId:
                  typeof variant === 'number' && Number.isSafeInteger(variant) && variant > 0
                    ? String(variant)
                    : text(variant),
                quantity: quantity(value?.quantity),
                validQuantity: value?.quantity === undefined || (quantity(value.quantity) ?? 0) > 0,
              };
            })
          : [];
        let result: Record<string, unknown> | null;
        try {
          result = object(await promise);
        } catch {
          ignore('Shopify addition ignored: the operation failed or was aborted.');
          return;
        }
        if (!active) return;
        if (!lines.length || lines.some((line) => !line.variantId || !line.validQuantity)) {
          ignore('Shopify addition ignored: invalid requested lines.');
          return;
        }
        const errors = result?.userErrors;
        const warnings = result?.warnings;
        // Optional arrays may be omitted. Malformed outcomes are not success evidence.
        if (errors !== undefined && (!Array.isArray(errors) || errors.length)) {
          ignore('Shopify addition ignored: the cart returned userErrors.');
          return;
        }
        if (warnings !== undefined && (!Array.isArray(warnings) || warnings.length)) {
          // No prior cart or variant-to-cart-line mapping exists in this event contract.
          // Even a positive final quantity can be old stock, so do not infer a delta.
          ignore('Shopify addition ignored: warnings make the confirmed addition uncertain.');
          return;
        }
        const cart = object(result?.cart);
        const cartLines = Array.isArray(cart?.lines)
          ? cart.lines.map((entry) => {
              const line = object(entry);
              return {
                id: text(line?.id),
                quantity: quantity(line?.quantity),
                totalAmount: money(line?.cost),
              };
            })
          : null;
        const totalQuantity = quantity(cart?.totalQuantity);
        if (
          !cart ||
          (totalQuantity !== null
            ? totalQuantity <= 0
            : !cartLines?.some((line) => (line.quantity ?? 0) > 0))
        ) {
          ignore('Shopify addition ignored: missing or empty resulting cart quantities.');
          return;
        }
        const requested = lines.map((line) => ({
          variantId: line.variantId as string,
          quantity: line.quantity,
        }));
        const requestedTotal = requested.every((line) => line.quantity !== null)
          ? requested.reduce((sum, line) => sum + (line.quantity ?? 0), 0)
          : null;
        const lineTotal = cartLines?.every((line) => line.quantity !== null)
          ? cartLines.reduce((sum, line) => sum + (line.quantity ?? 0), 0)
          : null;
        if (
          requestedTotal !== null &&
          (!Number.isSafeInteger(requestedTotal) ||
            (totalQuantity !== null && totalQuantity < requestedTotal) ||
            (lineTotal !== null && lineTotal < requestedTotal))
        ) {
          ignore(
            'Shopify addition ignored: resulting quantities do not support the requested addition.',
          );
          return;
        }
        onAddition({
          platform: 'shopify',
          event: 'product-added-to-cart',
          requested: { lines: requested, totalQuantity: requestedTotal },
          addition: {
            basis: 'successful-mutation',
            lines: requested.map((line) => ({ ...line })),
            totalQuantity: requestedTotal,
          },
          cart: {
            id: text(cart.id),
            totalQuantity,
            totalAmount: money(cart.cost),
            lines: cartLines,
          },
          warnings: [],
        });
      }
      const listener = (event: Event) => {
        void observe(event);
      };
      doc.addEventListener('shopify:cart:lines-update', listener);
      return () => {
        active = false;
        doc.removeEventListener('shopify:cart:lines-update', listener);
      };
    },
  };
}

export function startCommerceTrigger(
  nodeId: string,
  config: StepConfig,
  context: RuntimeContext,
  run: RunTrigger,
  { createShopifyAdapter }: { createShopifyAdapter: () => CommerceAdapter },
): void {
  if (config.commercePlatform !== undefined && config.commercePlatform !== 'shopify') {
    context.log(nodeId, 'error', 'Unsupported commerce platform. Only Shopify is supported.');
    return;
  }
  const adapter = createShopifyAdapter();
  context.cleanups.add(
    adapter.subscribe(
      context.doc,
      (data) => {
        if (!context.destroyed)
          void run(nodeId, { exists: true, value: data }).catch(context.reportFailure);
      },
      (message) => context.log(nodeId, 'error', message),
    ),
  );
}
