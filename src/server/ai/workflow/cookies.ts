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
    throw new Error('Enter a cookie name without spaces or separators such as = and ;.');
  if (/^__(?:Host-)?Http-/.test(name))
    throw new Error('Cookies with an HttpOnly name prefix must be set by a server.');
  if (typeof value !== 'string')
    throw new Error('Enter a cookie value (an empty string is allowed).');
  const days = config.cookieDays === undefined ? 0 : config.cookieDays;
  if (!Number.isInteger(days) || days < 0 || days > 400)
    throw new Error('Cookie lifetime must be an integer from 0 (session) to 400 days.');
  let cookie: string;
  try {
    cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
  } catch {
    throw new Error('Cookie names and values must contain valid Unicode text.');
  }
  if (days > 0) cookie += `; Max-Age=${days * 86400}`;
  // Reserve room for Secure, which the runtime adds on HTTPS pages.
  if (`${cookie}; Secure`.length > 4096)
    throw new Error('The encoded cookie and its settings must fit within 4,096 bytes.');
  return cookie;
}
