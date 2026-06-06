import { translateMihomoProxies } from './mihomo-to-sing';
import { saveMihomo } from './state';
import { rebuildSingCaches } from './sing-box';
import type { AppState, Env } from './types';
import { fetchText, parseJsonObject } from './utils';

export async function addSingBoxSubscription(env: Env, state: AppState, input: { name: string; url: string; id?: string }): Promise<any> {
  const config = parseJsonObject(await fetchText(input.url, env));
  const item = upsertSingBoxConfig(state, input.name, input.url, config, input.id);
  await rebuildSingCaches(env, state);
  return { item, updatedAt: state.singCache.updatedAt };
}

export async function addMihomoSubscription(env: Env, state: AppState, input: { name: string; url: string; id?: string; healthCheck?: string; interval?: number }): Promise<any> {
  const source = await fetchText(input.url, env);
  const outbounds = translateMihomoProxies(source);
  if (outbounds.length === 0) throw new Error('No supported proxies found');

  state.mihomoProviders[input.name] = {
    type: 'http',
    interval: Number(input.interval || 3600),
    url: input.url,
    'health-check': { enable: true, url: input.healthCheck || 'https://cp.cloudflare.com' },
  };
  await saveMihomo(env, state);

  const item = upsertSingBoxConfig(state, input.name, input.url, { outbounds }, input.id);
  await rebuildSingCaches(env, state);
  return { item, imported: outbounds.length, updatedAt: state.singCache.updatedAt };
}

export async function importMihomoProxies(env: Env, state: AppState, input: { name: string; url?: string; content?: string; id?: string }): Promise<any> {
  const source = input.url ? await fetchText(input.url, env) : input.content || '';
  if (!source.trim()) throw new Error('Missing mihomo yaml content or url');
  const outbounds = translateMihomoProxies(source);
  if (outbounds.length === 0) throw new Error('No supported proxies found');

  const item = upsertSingBoxConfig(state, input.name, input.url || 'mihomo-proxies://inline', { outbounds }, input.id);
  await rebuildSingCaches(env, state);
  return { item, imported: outbounds.length, updatedAt: state.singCache.updatedAt };
}

function upsertSingBoxConfig(state: AppState, name: string, url: string, config: any, id?: string): any {
  const itemId = id || crypto.randomUUID();
  const item = {
    id: itemId,
    name,
    url,
    updatedAt: new Date().toISOString(),
    size: JSON.stringify(config).length,
  };
  state.singSubs = state.singSubs.filter((sub) => sub.id !== itemId).concat(item);
  state.singSubConfigs[itemId] = config;
  return item;
}
