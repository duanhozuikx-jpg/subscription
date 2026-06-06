import { buildMihomo } from './mihomo';
import { rebuildSingCaches } from './sing-box';
import type { AppState, Env } from './types';

export async function downloadConfig(request: Request, env: Env, state: AppState): Promise<Response> {
  const url = new URL(request.url);
  const target = detectTarget(request, url);

  if (target === 'mihomo') {
    return new Response(buildMihomo(state), {
      headers: {
        'Content-Type': 'application/yaml; charset=utf-8',
        'Content-Disposition': 'attachment; filename="mihomo.yaml"',
      },
    });
  }

  if (!state.singCache.android || !state.singCache.other) await rebuildSingCaches(env, state);
  const config = target === 'sing-box-android' ? state.singCache.android : state.singCache.other;
  return new Response(JSON.stringify(config, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${target}.json"`,
    },
  });
}

function detectTarget(request: Request, url: URL): 'mihomo' | 'sing-box-android' | 'sing-box' {
  const target = (url.searchParams.get('target') || url.searchParams.get('format') || '').toLowerCase();
  if (['mihomo', 'clash', 'clash-meta', 'yaml'].includes(target)) return 'mihomo';
  if (['sing-box-android', 'android', 'sfa'].includes(target)) return 'sing-box-android';
  if (['sing-box', 'singbox', 'json'].includes(target)) return 'sing-box';

  const ua = request.headers.get('User-Agent') || '';
  if (/mihomo|clash|stash|verge|meta/i.test(ua)) return 'mihomo';
  if (/SFA|sing-box.*android|Android/i.test(ua)) return 'sing-box-android';
  return 'sing-box';
}
