import { translateMihomoProxies } from './mihomo-to-sing';
import { saveMihomo } from './state';
import { rebuildSingCaches } from './sing-box';
import type { AppState, Env } from './types';
import { fetchText, parseConfigText, parseJsonObject } from './utils';

export async function addSingBoxSubscription(env: Env, state: AppState, input: { name: string; url: string; id?: string }): Promise<any> {
  const config = parseJsonObject(await fetchText(input.url, env));
  const item = upsertSingBoxConfig(state, input.name, input.url, config, input.id, 'sing-box');
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

  const item = upsertSingBoxConfig(state, input.name, input.url, { outbounds }, input.id, 'mihomo');
  await rebuildSingCaches(env, state);
  return { item, imported: outbounds.length, updatedAt: state.singCache.updatedAt };
}

export async function addMihomoDirectSubscription(env: Env, state: AppState, input: { name: string; url: string; id?: string; healthCheck?: string; interval?: number }): Promise<any> {
  state.mihomoProviders[input.name] = {
    type: 'http',
    interval: Number(input.interval || 3600),
    url: input.url,
    'health-check': { enable: true, url: input.healthCheck || 'https://cp.cloudflare.com' },
  };
  await saveMihomo(env, state);

  const item = upsertSingBoxConfig(state, input.name, input.url, {}, input.id, 'mihomo-raw');
  return { item, updatedAt: item.updatedAt };
}

export async function importMihomoProxies(env: Env, state: AppState, input: { name: string; url?: string; content?: string; id?: string }): Promise<any> {
  const source = input.url ? await fetchText(input.url, env) : input.content || '';
  if (!source.trim()) throw new Error('Missing mihomo yaml content or url');
  const outbounds = translateMihomoProxies(source);
  if (outbounds.length === 0) throw new Error('No supported proxies found');

  const item = upsertSingBoxConfig(state, input.name, input.url || 'mihomo-proxies://inline', { outbounds }, input.id, input.url ? 'mihomo' : 'mihomo-inline');
  await rebuildSingCaches(env, state);
  return { item, imported: outbounds.length, updatedAt: state.singCache.updatedAt };
}

export async function updateSingBoxSubscription(env: Env, state: AppState, id: string): Promise<any | null> {
  const item = state.singSubs.find((sub) => sub.id === id);
  if (!item) return null;
  if (item.url.startsWith('mihomo-proxies://')) {
    item.sourceType = 'mihomo-inline';
    item.updatedAt = new Date().toISOString();
    await rebuildSingCaches(env, state);
    return item;
  }

  const sourceType = inferSourceType(state, item);
  if (sourceType === 'mihomo') {
    const source = await fetchText(item.url, env);
    const outbounds = translateMihomoProxies(source);
    if (outbounds.length === 0) throw new Error(`No supported proxies found: ${item.name}`);
    const config = { outbounds };
    item.sourceType = 'mihomo';
    item.updatedAt = new Date().toISOString();
    item.size = JSON.stringify(config).length;
    state.singSubConfigs[id] = config;
    await rebuildSingCaches(env, state);
    return item;
  }

  const source = await fetchText(item.url, env);
  const parsed = parseConfigText(source);
  const isMihomo = Array.isArray(parsed?.proxies);
  const config = isMihomo ? { outbounds: translateMihomoProxies(source) } : parsed;
  if (isMihomo && config.outbounds.length === 0) throw new Error(`No supported proxies found: ${item.name}`);
  item.sourceType = isMihomo ? 'mihomo' : 'sing-box';
  item.updatedAt = new Date().toISOString();
  item.size = JSON.stringify(config).length;
  state.singSubConfigs[id] = config;
  await rebuildSingCaches(env, state);
  return item;
}

function inferSourceType(state: AppState, item: any): 'sing-box' | 'mihomo' | 'mihomo-inline' {
  if (item.sourceType) return item.sourceType;
  if (item.url.startsWith('mihomo-proxies://')) return 'mihomo-inline';
  const provider = state.mihomoProviders[item.name];
  if (provider?.url === item.url) return 'mihomo';
  return 'sing-box';
}

function upsertSingBoxConfig(state: AppState, name: string, url: string, config: any, id?: string,   sourceType: 'sing-box' | 'mihomo' | 'mihomo-inline' | 'mihomo-raw' = 'sing-box'): any {
  const itemId = id || crypto.randomUUID();
  const item = {
    id: itemId,
    name,
    url,
    sourceType,
    updatedAt: new Date().toISOString(),
    size: JSON.stringify(config).length,
  };
  state.singSubs = state.singSubs.filter((sub) => sub.id !== itemId).concat(item);
  state.singSubConfigs[itemId] = config;
  return item;
}
