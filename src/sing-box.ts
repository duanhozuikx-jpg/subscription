import { COUNTRY_RULES, DEFAULT_SING_TEMPLATE } from './defaults';
import { saveSingBox } from './state';
import type { AppState, Env, JsonMap, SingGroupRule } from './types';
import { clone, deepMerge, unique } from './utils';

export async function rebuildSingCaches(env: Env, state: AppState): Promise<void> {
  state.singCache = {
    android: mergeSingBox(state, 'android'),
    other: mergeSingBox(state, 'other'),
    updatedAt: new Date().toISOString(),
  };
  await saveSingBox(env, state);
}

function mergeSingBox(state: AppState, platform: 'android' | 'other'): JsonMap {
  const template = clone(state.singTemplate || DEFAULT_SING_TEMPLATE);
  const templateOutbounds = Array.isArray(template.outbounds) ? template.outbounds : [];
  const subscriptionOutbounds = Object.values(state.singSubConfigs)
    .flatMap((config) => (Array.isArray(config?.outbounds) ? config.outbounds : []))
    .filter((outbound) => outbound?.tag && !isRuleOutbound(outbound) && !isGroupOutbound(outbound));

  const nodeByTag = new Map<string, any>();
  for (const outbound of subscriptionOutbounds) nodeByTag.set(outbound.tag, outbound);
  const nodeTags = [...nodeByTag.keys()];
  const regionMap = new Map<string, string[]>();
  for (const tag of nodeTags) {
    const region = inferRegion(tag);
    regionMap.set(region, [...(regionMap.get(region) || []), tag]);
  }

  const generatedRegions = [...regionMap.entries()].map(([tag, outbounds]) => ({
    type: 'urltest',
    tag,
    outbounds: unique(outbounds),
    url: 'https://cp.cloudflare.com',
    interval: '5m',
  }));
  const regionTags = generatedRegions.map((group) => group.tag);
  const templateRegionTags = COUNTRY_RULES.map((rule) => rule.tag).concat('🌐OTHER');

  const rebuiltOutbounds: any[] = [];
  for (const outbound of templateOutbounds) {
    if (!outbound?.tag) continue;
    if (templateRegionTags.includes(outbound.tag) || outbound.tag === '🔥AUTO') continue;
    if (isGroupOutbound(outbound) && Array.isArray(outbound.outbounds)) {
      const outbounds: string[] = outbound.outbounds.flatMap((tag: string) => (templateRegionTags.includes(tag) ? regionTags : [tag]));
      const filteredOutbounds = applyGroupRule(outbound.tag, unique(outbounds), state.singGroupRules, [...nodeByTag.values()], regionTags);
      rebuiltOutbounds.push({
        ...outbound,
        outbounds: filteredOutbounds.filter(
          (tag) => regionTags.includes(tag) || nodeTags.includes(tag) || tag === 'direct' || tag === 'block' || tag === '🔥AUTO' || hasOutboundTag(templateOutbounds, tag),
        ),
      });
    } else if (!nodeByTag.has(outbound.tag)) {
      rebuiltOutbounds.push(outbound);
    }
  }

  if (nodeTags.length > 0) {
    rebuiltOutbounds.push({
      type: 'urltest',
      tag: '🔥AUTO',
      outbounds: nodeTags,
      url: 'https://cp.cloudflare.com',
      interval: '15m',
    });
  }
  rebuiltOutbounds.push(...generatedRegions);
  rebuiltOutbounds.push(...nodeByTag.values());

  template.outbounds = dedupeOutbounds(rebuiltOutbounds);
  if (!hasOutboundTag(template.outbounds, 'direct')) template.outbounds.push({ type: 'direct', tag: 'direct' });
  if (!hasOutboundTag(template.outbounds, 'block')) template.outbounds.push({ type: 'block', tag: 'block' });

  const patched = deepMerge(template, state.singPatches[platform] || {});
  if (platform !== 'android' && patched.route) delete patched.route.override_android_vpn;
  return patched;
}

function isRuleOutbound(outbound: any): boolean {
  return ['direct', 'block', 'dns'].includes(outbound?.type);
}

function isGroupOutbound(outbound: any): boolean {
  return ['selector', 'urltest', 'url-test', 'fallback', 'loadbalance'].includes(outbound?.type);
}

function inferRegion(tag: string): string {
  for (const rule of COUNTRY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(tag))) return rule.tag;
  }
  return '🌐OTHER';
}

function hasOutboundTag(outbounds: any[], tag: string): boolean {
  return outbounds.some((outbound) => outbound?.tag === tag);
}

function dedupeOutbounds(outbounds: any[]): any[] {
  const seen = new Set<string>();
  const output: any[] = [];
  for (const outbound of outbounds) {
    if (!outbound?.tag || seen.has(outbound.tag)) continue;
    seen.add(outbound.tag);
    output.push(outbound);
  }
  return output;
}

function applyGroupRule(groupTag: string, currentTags: string[], rules: SingGroupRule[], nodes: any[], regionTags: string[]): string[] {
  const rule = rules.find((item) => item.tag === groupTag);
  if (!rule) return currentTags;

  const nodeTagSet = new Set(nodes.map((node) => node.tag));
  const baseTags = rule.includeAll ? nodes.map((node) => node.tag) : currentTags;
  const filteredTags = baseTags.filter((tag) => {
    if (regionTags.includes(tag)) return !!rule.includeRegions;
    const node = nodeTagSet.has(tag) ? nodes.find((item) => item.tag === tag) : null;
    return node ? matchNode(node, rule) : true;
  });

  if (rule.includeRegions) filteredTags.push(...regionTags);
  return unique(filteredTags);
}

function matchNode(node: any, rule: SingGroupRule): boolean {
  if (rule.excludeName && new RegExp(rule.excludeName, 'i').test(node.tag || '')) return false;
  if (rule.excludeTypes?.length && rule.excludeTypes.includes(node.type)) return false;
  return true;
}
