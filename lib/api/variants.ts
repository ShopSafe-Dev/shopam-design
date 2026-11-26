import apiClient from './config';
import type { ProductVariant } from './types';

export interface VariantInput {
  attributes: Record<string, string>;
  sku?: string | null;
  /** null clears the override (the product price is used). */
  price_override?: string | null;
  stock_quantity?: number;
}

const base = (productId: string) => `/api/commerce/products/${productId}/variants`;

export const variantsService = {
  async list(productId: string): Promise<ProductVariant[]> {
    const res = await apiClient.get<ProductVariant[] | { results: ProductVariant[] }>(base(productId));
    return Array.isArray(res.data) ? res.data : res.data.results;
  },

  async create(productId: string, data: VariantInput): Promise<ProductVariant> {
    return (await apiClient.post<ProductVariant>(base(productId), data)).data;
  },

  async update(productId: string, variantId: string, data: Partial<VariantInput>): Promise<ProductVariant> {
    return (await apiClient.patch<ProductVariant>(`${base(productId)}/${variantId}`, data)).data;
  },

  /** Upload pictures (JPEG/PNG/WebP, 5 MB each, 5 per variant). Returns the variant with all its pictures. */
  async addImages(productId: string, variantId: string, files: File[]): Promise<ProductVariant> {
    const form = new FormData();
    files.forEach((f) => form.append('images', f));
    return (await apiClient.post<ProductVariant>(`${base(productId)}/${variantId}/images`, form)).data;
  },

  async removeImage(productId: string, variantId: string, imageId: string): Promise<void> {
    await apiClient.delete(`${base(productId)}/${variantId}/images/${imageId}`);
  },

  async remove(productId: string, variantId: string): Promise<void> {
    await apiClient.delete(`${base(productId)}/${variantId}`);
  },
};
