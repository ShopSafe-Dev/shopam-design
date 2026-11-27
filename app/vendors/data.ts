import type { Vendor } from '@/lib/api';

export type VendorSort = 'top-rated' | 'most-reviewed' | 'name';

export const VENDOR_SORTS: { id: VendorSort; label: string }[] = [
  { id: 'top-rated', label: 'Top rated' },
  { id: 'most-reviewed', label: 'Most reviewed' },
  { id: 'name', label: 'Name (A–Z)' },
];

/** Maps the shared category-pill slugs to keywords found in vendor categories. */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  home_living: ['home'],
  beauty_hair_personal_care: ['beauty', 'hair'],
  accessories: ['accessor'],
  mens_fashion: ['men'],
  womens_fashion: ['women'],
  baby_kids: ['baby', 'kid'],
  food_drinks: ['food', 'drink'],
};

export function matchesCategory(vendor: Vendor, slug: string): boolean {
  const keywords = CATEGORY_KEYWORDS[slug];
  if (!keywords) return false;
  const haystack = `${vendor.category} ${vendor.name}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

