import { dataTools } from './data';
import type { StepConfig } from './types';

/** Check template syntax and literal cookie settings without requiring incoming data. */
export function validateCookie(config: StepConfig): void {
  dataTools.validateTemplate(config.cookieName);
  dataTools.validateTemplate(config.cookieValue);
  buildCookie({
    ...config,
    cookieName:
      typeof config.cookieName === 'string'
        ? config.cookieName.replace(/\{\{[\s\S]*?\}\}/g, 'x')
        : config.cookieName,
    cookieValue:
      typeof config.cookieValue === 'string'
        ? config.cookieValue.replace(/\{\{[\s\S]*?\}\}/g, '')
        : config.cookieValue,
  });
}

/** Self-contained so validation and standalone workflow scripts use the same rules. */
export function buildCookie(config: StepConfig): string {
  const { cookieName: name, cookieValue: value } = config;
  if (typeof name !== 'string' || !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name))
    throw Object.assign(
      new Error('Enter a cookie name without spaces or separators such as = and ;.'),
      {
        messageKey: 'errors.cookies.enterACookieNameWithoutSpacesOrSeparatorsSuchAs',
        messageParams: {},
      },
    );
  if (/^__(?:Host-)?Http-/.test(name))
    throw Object.assign(
      new Error('Cookies with an HttpOnly name prefix must be set by a server.'),
      {
        messageKey: 'errors.cookies.cookiesWithAnHttponlyNamePrefixMustBeSetBy',
        messageParams: {},
      },
    );
  if (typeof value !== 'string')
    throw Object.assign(new Error('Enter a cookie value (an empty string is allowed).'), {
      messageKey: 'errors.cookies.enterACookieValueAnEmptyStringIsAllowed',
      messageParams: {},
    });
  const days = config.cookieDays === undefined ? 0 : config.cookieDays;
  if (!Number.isInteger(days) || days < 0 || days > 400)
    throw Object.assign(
      new Error('Cookie lifetime must be an integer from 0 (session) to 400 days.'),
      {
        messageKey: 'errors.cookies.cookieLifetimeMustBeAnIntegerFrom0SessionTo',
        messageParams: {},
      },
    );
  let cookie: string;
  try {
    cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
  } catch {
    throw Object.assign(new Error('Cookie names and values must contain valid Unicode text.'), {
      messageKey: 'errors.cookies.cookieNamesAndValuesMustContainValidUnicodeText',
      messageParams: {},
    });
  }
  if (days > 0) cookie += `; Max-Age=${days * 86400}`;
  // Reserve room for Secure, which the runtime adds on HTTPS pages.
  if (`${cookie}; Secure`.length > 4096)
    throw Object.assign(
      new Error('The encoded cookie and its settings must fit within 4,096 bytes.'),
      {
        messageKey: 'errors.cookies.theEncodedCookieAndItsSettingsMustFitWithin4',
        messageParams: {},
      },
    );
  return cookie;
}
