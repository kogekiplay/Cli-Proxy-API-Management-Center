import { apiClient } from './client';
import type { ModelPrice } from '@/types/usage';

interface ModelPricesResponse {
  prices?: ModelPrice[];
}

export const modelPricesApi = {
  async list(): Promise<ModelPrice[]> {
    const data = await apiClient.get<ModelPricesResponse>('/model-prices');
    return Array.isArray(data.prices) ? data.prices : [];
  },

  replace(prices: ModelPrice[]): Promise<{ status: string }> {
    return apiClient.put('/model-prices', { prices });
  },

  async upsert(model: string, price: ModelPrice): Promise<{ status: string }> {
    const prices = await modelPricesApi.list();
    const normalizedModel = model.trim();
    const next = [
      ...prices.filter((item) => item.model !== normalizedModel),
      { ...price, model: normalizedModel },
    ];
    return modelPricesApi.replace(next);
  },

  async delete(model: string): Promise<{ status: string }> {
    const normalizedModel = model.trim();
    const prices = await modelPricesApi.list();
    return modelPricesApi.replace(prices.filter((item) => item.model !== normalizedModel));
  },
};
