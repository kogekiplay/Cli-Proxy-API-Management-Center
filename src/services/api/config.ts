/**
 * 配置相关 API
 */

import { apiClient } from './client';
import type { Config } from '@/types';
import { normalizeConfigResponse } from './transformers';

export const configApi = {
  /**
   * 获取配置（会进行字段规范化）
   */
  async getConfig(): Promise<Config> {
    const raw = await apiClient.get('/config');
    return normalizeConfigResponse(raw);
  },

  /**
   * 请求日志开关
   */
  updateRequestLog: (enabled: boolean) => apiClient.put('/request-log', { value: enabled }),

  /**
   * 获取路由策略
   */
  async getRoutingStrategy(): Promise<string> {
    const data = await apiClient.get<Record<string, unknown>>('/routing/strategy');
    const strategy = data?.strategy;
    return typeof strategy === 'string' ? strategy : 'round-robin';
  },

  /**
   * 更新路由策略
   */
  updateRoutingStrategy: (strategy: string) =>
    apiClient.put('/routing/strategy', { value: strategy }),
};
