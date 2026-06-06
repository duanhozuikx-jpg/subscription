import yaml from 'js-yaml';
import { DEFAULT_MIHOMO_TEMPLATE } from './defaults';
import type { AppState } from './types';
import { clone } from './utils';

export function buildMihomo(state: AppState): string {
  const config = clone(state.mihomoTemplate || DEFAULT_MIHOMO_TEMPLATE);
  delete config['proxy-providers'];
  config['proxy-providers'] = state.mihomoProviders;
  return yaml.dump(config, { indent: 2, lineWidth: -1, noRefs: true });
}
