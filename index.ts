import { handleApi } from './src/api';
import { requireAuth } from './src/auth';
import { downloadConfig } from './src/download';
import { handleExternalApi } from './src/external-api';
import { advancedPath, configPath, renderAdvancedPanel, renderConfigPanel, renderPanel } from './src/panel';
import { loadState } from './src/state';
import type { Env } from './src/types';
import { jsonResponse, normalizePath, textResponse } from './src/utils';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const state = await loadState(env);
    const publicPath = normalizePath(state.settings.publicPath, '/sub');
    const panelPath = normalizePath(state.settings.panelPath, '/');
    const externalApiPath = normalizePath(state.settings.apiPath, '/external-api');
    const advancedPanelPath = normalizePath(advancedPath(state), '/advanced');
    const configPanelPath = normalizePath(configPath(state), '/config');
    const path = normalizePath(url.pathname, '/');

    try {
      if (path === publicPath) return downloadConfig(request, env, state);
      if (path === externalApiPath) return handleExternalApi(request, env, state);
      if (path.startsWith('/api/')) return handleApi(request, env, state);
      if (path === panelPath) {
        const authError = await requireAuth(request, env);
        if (authError) return authError;
        return renderPanel(state);
      }
      if (path === advancedPanelPath) {
        const authError = await requireAuth(request, env);
        if (authError) return authError;
        return renderAdvancedPanel(state);
      }
      if (path === configPanelPath) {
        const authError = await requireAuth(request, env);
        if (authError) return authError;
        return renderConfigPanel(state);
      }
      return textResponse('Not Found', 404);
    } catch (error: any) {
      return jsonResponse({ error: error?.message || String(error) }, 500);
    }
  },
};
