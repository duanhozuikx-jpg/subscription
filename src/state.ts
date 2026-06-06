import { DEFAULT_MIHOMO_TEMPLATE, DEFAULT_SETTINGS, DEFAULT_SING_TEMPLATE, MIHOMO_KEY, SETTINGS_KEY, SING_BOX_KEY } from './defaults';
import type { AppState, Env, JsonMap } from './types';
import { clone } from './utils';

export async function loadState(env: Env): Promise<AppState> {
  const [settingsRaw, singRaw, mihomoRaw] = await Promise.all([
    env.CONFIG_KV.get(SETTINGS_KEY),
    env.CONFIG_KV.get(SING_BOX_KEY),
    env.CONFIG_KV.get(MIHOMO_KEY),
  ]);

  const state = defaultState();
  if (settingsRaw) state.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsRaw) };
  if (singRaw) Object.assign(state, normalizeSingState(JSON.parse(singRaw)));
  if (mihomoRaw) Object.assign(state, normalizeMihomoState(JSON.parse(mihomoRaw)));
  return state;
}

export async function saveState(env: Env, state: AppState): Promise<void> {
  await Promise.all([saveSettings(env, state), saveSingBox(env, state), saveMihomo(env, state)]);
}

export async function saveSettings(env: Env, state: AppState): Promise<void> {
  await env.CONFIG_KV.put(SETTINGS_KEY, JSON.stringify(state.settings));
}

export async function saveSingBox(env: Env, state: AppState): Promise<void> {
  await env.CONFIG_KV.put(SING_BOX_KEY, JSON.stringify(pickSingState(state)));
}

export async function saveMihomo(env: Env, state: AppState): Promise<void> {
  await env.CONFIG_KV.put(MIHOMO_KEY, JSON.stringify(pickMihomoState(state)));
}

export function defaultState(): AppState {
  const defaultMihomoTemplate = clone(DEFAULT_MIHOMO_TEMPLATE);
  const defaultMihomoProviders = defaultMihomoTemplate['proxy-providers'] || {};
  delete defaultMihomoTemplate['proxy-providers'];

  return {
    settings: clone(DEFAULT_SETTINGS),
    singTemplate: clone(DEFAULT_SING_TEMPLATE),
    singSubs: [],
    singSubConfigs: {},
    singPatches: { android: defaultAndroidPatch(), other: {} },
    singGroupRules: [],
    singCache: { android: null, other: null },
    singTemplateUrl: '',
    mihomoTemplate: defaultMihomoTemplate,
    mihomoTemplateUrl: '',
    mihomoProviders: defaultMihomoProviders,
  };
}

export function defaultAndroidPatch(): JsonMap {
  return { route: { override_android_vpn: true } };
}

function normalizeSingState(value: any): Pick<AppState, 'singTemplate' | 'singTemplateUrl' | 'singSubs' | 'singSubConfigs' | 'singPatches' | 'singGroupRules' | 'singCache'> {
  return {
    singTemplate: value.singTemplate || clone(DEFAULT_SING_TEMPLATE),
    singTemplateUrl: value.singTemplateUrl || '',
    singSubs: value.singSubs || [],
    singSubConfigs: value.singSubConfigs || {},
    singPatches: {
      android: value.singPatches?.android || defaultAndroidPatch(),
      other: value.singPatches?.other || {},
    },
    singGroupRules: value.singGroupRules || [],
    singCache: value.singCache || { android: null, other: null },
  };
}

function normalizeMihomoState(value: any): Pick<AppState, 'mihomoTemplate' | 'mihomoTemplateUrl' | 'mihomoProviders'> {
  const mihomoTemplate = value.mihomoTemplate || clone(DEFAULT_MIHOMO_TEMPLATE);
  const embeddedProviders = mihomoTemplate['proxy-providers'] || {};
  delete mihomoTemplate['proxy-providers'];
  return {
    mihomoTemplate,
    mihomoTemplateUrl: value.mihomoTemplateUrl || '',
    mihomoProviders: { ...embeddedProviders, ...(value.mihomoProviders || {}) },
  };
}

function pickSingState(state: AppState): Pick<AppState, 'singTemplate' | 'singTemplateUrl' | 'singSubs' | 'singSubConfigs' | 'singPatches' | 'singGroupRules' | 'singCache'> {
  return {
    singTemplate: state.singTemplate,
    singTemplateUrl: state.singTemplateUrl,
    singSubs: state.singSubs,
    singSubConfigs: state.singSubConfigs,
    singPatches: state.singPatches,
    singGroupRules: state.singGroupRules,
    singCache: state.singCache,
  };
}

function pickMihomoState(state: AppState): Pick<AppState, 'mihomoTemplate' | 'mihomoTemplateUrl' | 'mihomoProviders'> {
  const mihomoTemplate = clone(state.mihomoTemplate);
  delete mihomoTemplate['proxy-providers'];
  return {
    mihomoTemplate,
    mihomoTemplateUrl: state.mihomoTemplateUrl,
    mihomoProviders: state.mihomoProviders,
  };
}
