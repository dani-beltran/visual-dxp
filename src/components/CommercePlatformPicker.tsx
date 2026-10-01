import { useId, useState } from 'react';
import { useBuilderI18n } from '../lib/i18nContext';
import { CommercePlatformIcon } from './CommercePlatformIcon';
import '../styles/commerce-picker.css';

const platforms = [
  ['shopify', 'Shopify'],
  ['woocommerce', 'WooCommerce'],
  ['prestashop', 'PrestaShop'],
  ['bigcommerce', 'BigCommerce'],
  ['adobe-commerce', 'Adobe Commerce'],
  ['ecwid', 'Ecwid'],
  ['wix-ecommerce', 'Wix eCommerce'],
] as const;

// Product requirement: preserve this exact copy in every locale and host catalog.
const premiumExplanation = 'Premium feature - contact the developer';

export function CommercePlatformPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (platform: 'shopify') => void;
}) {
  const { t } = useBuilderI18n();
  const id = useId();
  const [explanation, setExplanation] = useState<string | null>(null);
  const [focused, setFocused] = useState(value);
  const supported = value === 'shopify';
  return (
    <fieldset className="dxp-commerce-picker">
      <legend id={`${id}-label`}>{t('commerce.platform')}</legend>
      <div role="radiogroup" aria-labelledby={`${id}-label`}>
        {platforms.map(([platform, label], index) => {
          const premium = platform !== 'shopify';
          return (
            // biome-ignore lint/a11y/useSemanticElements: Custom radios allow focus on disabled choices for explanations without native radio selection.
            <button
              key={platform}
              type="button"
              role="radio"
              aria-checked={value === platform}
              aria-disabled={premium || undefined}
              aria-describedby={premium ? `${id}-premium` : undefined}
              tabIndex={
                platform === focused || (index === 0 && !platforms.some(([key]) => key === focused))
                  ? 0
                  : -1
              }
              onFocus={() => {
                setFocused(platform);
                setExplanation(premium ? platform : null);
              }}
              onBlur={() => setExplanation(null)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setExplanation(null);
                const direction = ['ArrowDown', 'ArrowRight'].includes(event.key)
                  ? 1
                  : ['ArrowUp', 'ArrowLeft'].includes(event.key)
                    ? -1
                    : 0;
                if (direction || event.key === 'Home' || event.key === 'End') {
                  event.preventDefault();
                  const next =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? platforms.length - 1
                        : (index + direction + platforms.length) % platforms.length;
                  const buttons =
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                      '[role="radio"]',
                    );
                  buttons?.[next]?.focus();
                  if (next === 0) onChange('shopify');
                }
              }}
              onClick={() => {
                // aria-disabled retains focus and touch explanations; activation is guarded.
                if (premium) setExplanation(platform);
                else {
                  setExplanation(null);
                  onChange('shopify');
                }
              }}
            >
              <span className="dxp-commerce-platform-label">
                <CommercePlatformIcon platform={platform} />
                <span>{label}</span>
              </span>
              {premium && <span className="dxp-commerce-premium">{t('commerce.premium')}</span>}
            </button>
          );
        })}
      </div>
      <p id={`${id}-premium`} role="tooltip" hidden={!explanation} className="dxp-commerce-tooltip">
        {premiumExplanation}
      </p>
      {!supported && (
        <p role="alert" className="dxp-inspector-hint">
          {t('commerce.unsupportedPlatform')} ({value})
        </p>
      )}
    </fieldset>
  );
}
