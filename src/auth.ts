import { SESSION_TTL_SECONDS } from './defaults';
import type { Env } from './types';
import { jsonResponse } from './utils';
import { renderLogin } from './panel';

export function getAdminUser(env: Env): string {
  return env.ADMIN_USER || env.INIT_USER || 'admin';
}

export function getAdminPassword(env: Env): string {
  return env.ADMIN_PASSWORD || env.INIT_PASSWORD || 'admin';
}

export function isDefaultCredential(env: Env): boolean {
  return getAdminUser(env) === 'admin' && getAdminPassword(env) === 'admin';
}

export async function isAuthenticated(request: Request, env: Env): Promise<boolean> {
  if (isDefaultCredential(env)) return false;

  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Basic ')) {
    const decoded = atob(auth.slice(6));
    const index = decoded.indexOf(':');
    return decoded.slice(0, index) === getAdminUser(env) && decoded.slice(index + 1) === getAdminPassword(env);
  }

  const cookie = request.headers.get('Cookie') || '';
  const session = cookie.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  if (!session) return false;
  return verifySession(session, env);
}

export async function createSession(env: Env): Promise<string> {
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS })));
  return `${payload}.${await sign(payload, getAdminPassword(env))}`;
}

export async function requireAuth(request: Request, env: Env): Promise<Response | null> {
  if (await isAuthenticated(request, env)) return null;
  if (new URL(request.url).pathname.startsWith('/api/')) return jsonResponse({ error: 'Unauthorized' }, 401);
  if (isDefaultCredential(env)) return renderLogin('默认 admin/admin 已禁用，请到 Cloudflare 控制台或 Wrangler 设置 ADMIN_PASSWORD 后再登录');
  return renderLogin();
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64Url(new Uint8Array(signature));
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function verifySession(value: string, env: Env): Promise<boolean> {
  const [payload, signature] = value.split('.');
  if (!payload || !signature || (await sign(payload, getAdminPassword(env))) !== signature) return false;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const data = JSON.parse(atob(normalized));
    return Number(data.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
