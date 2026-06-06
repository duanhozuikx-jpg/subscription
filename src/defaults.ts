import yaml from 'js-yaml';
import singBoxTemplate from '../template/template.json';
import mihomoTemplateYaml from '../template/template.yaml';
import type { JsonMap, Settings } from './types';

export const MAX_FETCH_SIZE = 10 * 1024 * 1024;
export const SETTINGS_KEY = 'settings_v1';
export const SING_BOX_KEY = 'sing_box_v1';
export const MIHOMO_KEY = 'mihomo_v1';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;

export const DEFAULT_SETTINGS: Settings = {
  publicPath: '/sub',
  panelPath: '/',
  apiPath: '/external-api',
  apiToken: '',
};

export const DEFAULT_SING_TEMPLATE: JsonMap = singBoxTemplate as JsonMap;
export const DEFAULT_MIHOMO_TEMPLATE: JsonMap = yaml.load(mihomoTemplateYaml) as JsonMap;

export const COUNTRY_RULES: Array<{ code: string; tag: string; patterns: RegExp[] }> = [
  { code: 'US', tag: '🇺🇸US', patterns: [/🇺🇸|美国|美國|united\s*states|\bus\b|usa|lax|sjc|nyc|sea|dal|chi/i] },
  { code: 'HK', tag: '🇭🇰HK', patterns: [/🇭🇰|香港|\bhk\b|hong\s*kong|hkg/i] },
  { code: 'TW', tag: '🇹🇼TW', patterns: [/🇹🇼|台湾|台灣|\btw\b|taiwan/i] },
  { code: 'SG', tag: '🇸🇬SG', patterns: [/🇸🇬|新加坡|\bsg\b|singapore/i] },
  { code: 'JP', tag: '🇯🇵JP', patterns: [/🇯🇵|日本|\bjp\b|japan|tokyo|osa/i] },
  { code: 'KR', tag: '🇰🇷KR', patterns: [/🇰🇷|韩国|韓國|\bkr\b|korea|seoul/i] },
  { code: 'UK', tag: '🇬🇧UK', patterns: [/🇬🇧|英国|英國|\buk\b|united\s*kingdom|london/i] },
  { code: 'DE', tag: '🇩🇪DE', patterns: [/🇩🇪|德国|德國|\bde\b|germany|frankfurt/i] },
  { code: 'NL', tag: '🇳🇱NL', patterns: [/🇳🇱|荷兰|荷蘭|\bnl\b|netherlands|amsterdam/i] },
  { code: 'TR', tag: '🇹🇷TR', patterns: [/🇹🇷|土耳其|\btr\b|turkey|istanbul/i] },
  { code: 'AU', tag: '🇦🇺AU', patterns: [/🇦🇺|澳大利亚|澳洲|\bau\b|australia|sydney/i] },
  { code: 'CA', tag: '🇨🇦CA', patterns: [/🇨🇦|加拿大|\bca\b|canada|toronto|vancouver/i] },
  { code: 'FR', tag: '🇫🇷FR', patterns: [/🇫🇷|法国|法國|\bfr\b|france|paris/i] },
  { code: 'FI', tag: '🇫🇮FI', patterns: [/🇫🇮|芬兰|芬蘭|\bfi\b|finland|helsinki/i] },
  { code: 'IN', tag: '🇮🇳IN', patterns: [/🇮🇳|印度|\bin\b|india|mumbai|delhi/i] },
  { code: 'ID', tag: '🇮🇩ID', patterns: [/🇮🇩|印尼|印度尼西亚|印度尼西亞|\bid\b|indonesia|jakarta/i] },
  { code: 'MY', tag: '🇲🇾MY', patterns: [/🇲🇾|马来|馬來|\bmy\b|malaysia|kuala/i] },
  { code: 'TH', tag: '🇹🇭TH', patterns: [/🇹🇭|泰国|泰國|\bth\b|thailand|bangkok/i] },
  { code: 'VN', tag: '🇻🇳VN', patterns: [/🇻🇳|越南|\bvn\b|vietnam|hanoi/i] },
  { code: 'PH', tag: '🇵🇭PH', patterns: [/🇵🇭|菲律宾|菲律賓|\bph\b|philippines|manila/i] },
  { code: 'BR', tag: '🇧🇷BR', patterns: [/🇧🇷|巴西|\bbr\b|brazil|sao\s*paulo/i] },
  { code: 'RU', tag: '🇷🇺RU', patterns: [/🇷🇺|俄罗斯|俄羅斯|\bru\b|russia|moscow/i] },
  { code: 'AE', tag: '🇦🇪AE', patterns: [/🇦🇪|阿联酋|阿聯酋|\bae\b|dubai|uae/i] },
];
