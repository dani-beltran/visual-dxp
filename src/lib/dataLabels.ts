import { dataTools } from './data';
import type { BuilderTranslator } from './i18n';
export function getDataOperators(t: BuilderTranslator) {
  return Object.fromEntries(
    Object.keys(dataTools.operators).map((key) => [
      key,
      t(`data.operator.${key as keyof typeof dataTools.operators}`),
    ]),
  );
}
export function dataHint(operator: string, t: BuilderTranslator): string {
  if (operator === 'contains' || operator === 'not-contains') return t('data.hint.1');
  if (operator === 'equal' || operator === 'not-equal') return t('data.hint.2');
  if (operator.includes('greater') || operator.includes('less')) return t('data.hint.3');
  if (operator === 'matches' || operator === 'not-matches') return t('data.hint.4');
  if (operator.includes('empty')) return t('data.hint.5');
  if (operator.includes('exists') || operator.includes('null')) return t('data.hint.6');
  if (operator === 'is-true' || operator === 'is-false') return t('data.hint.7');
  return t('data.hint.8');
}
