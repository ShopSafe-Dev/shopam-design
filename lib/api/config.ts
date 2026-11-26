import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { ensureDevSession } from '../devAuth';
import { clearUser } from '../auth/session';
import { clearAccessToken, getValidAccessToken, refreshAccessToken } from '../auth/token';
import { API_BASE_URL, API_IS_CROSS_ORIGIN } from './env';

// Base URL comes from env (see lib/api/env.ts). Empty = same-origin Next.js proxy.
export { API_BASE_URL };


const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  // Needed when calling the backend directly (refresh cookie across origins).
  withCredentials: API_IS_CROSS_ORIGIN,
});

// Dev-only: set the role hint cookie for the dev auth bypass.
ensureDevSession();

// Auth model: the short-lived access token is held in memory (lib/auth/token.ts) and sent as
// `Authorization: Bearer`. The long-lived refresh token is an HttpOnly cookie that only the
// refresh endpoint reads. A 401 triggers one refresh and one retry.
const NO_AUTH_PATHS = [
  API_ENDPOINTS_PREFIX('login'),
  API_ENDPOINTS_PREFIX('logout'),
  API_ENDPOINTS_PREFIX('token/refresh'),
  API_ENDPOINTS_PREFIX('register/'),
  API_ENDPOINTS_PREFIX('password/forgot'),
  API_ENDPOINTS_PREFIX('password/reset'),
  API_ENDPOINTS_PREFIX('user-verify'),
];

function API_ENDPOINTS_PREFIX(p: string) {
  return `/api/accounts/${p}`;
}

function skipsAuth(url?: string): boolean {
  if (!url) return false;
  return NO_AUTH_PATHS.some((p) => url.startsWith(p));
}

apiClient.interceptors.request.use(async (config) => {
  if (skipsAuth(config.url)) return config;
  const token = await getValidAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

type RetryConfig = InternalAxiosRequestConfig & { _retried?: boolean };

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ code?: string }>) => {
    const original = error.config as RetryConfig | undefined;
    const code = error.response?.data?.code;
    const unauthorized =
      error.response?.status === 401 && (code === 'SESSION_INVALID' || code === 'TOKEN_EXPIRED');

    if (unauthorized && original && !original._retried && !skipsAuth(original.url)) {
      original._retried = true;
      clearAccessToken();
      const token = await refreshAccessToken();
      if (token) {
        original.headers.set('Authorization', `Bearer ${token}`);
        return apiClient(original);
      }
    }
    // No session left (or refresh refused): drop the cached user. Guards decide whether to prompt sign-in.
    if (unauthorized) {
      clearAccessToken();
      clearUser();
    }
    return Promise.reject(error);
  }
);
export default apiClient;

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    USER_REGISTER: '/api/accounts/register/customer',
    VENDOR_REGISTER: '/api/accounts/register/vendor',
    LOGIN: '/api/accounts/login',
    LOGOUT: '/api/accounts/logout',
    PROFILE: '/api/accounts/profile',
    PROFILE_UPDATE: '/api/accounts/profile/update',
    PROFILE_DEACTIVATE: '/api/accounts/profile/deactivate',
    PASSWORD_CHANGE: '/api/accounts/password/change',
    FORGOT_PASSWORD: '/api/accounts/password/forgot',
    RESET_PASSWORD: '/api/accounts/password/reset',
    VERIFY_EMAIL: '/api/accounts/user-verify',
    TOKEN_REFRESH: '/api/accounts/token/refresh',
    VENDOR_LOGO: '/api/accounts/vendor/logo',
    BANKS: '/api/accounts/banks',
    BANK_RESOLVE: '/api/accounts/vendor/bank/resolve',
    BANK_CONFIRM: '/api/accounts/vendor/bank/confirm',
    VENDOR_PROFILE_UPDATE: '/api/accounts/profile/vendor-update',
  },

  // Products
  PRODUCTS: {
    LIST: '/api/commerce/products/',
    MY_PRODUCTS: '/api/commerce/my-products/',
    DETAIL: (id: string) => `/api/commerce/products/${id}/`,
    CREATE: '/api/commerce/products/',
    UPDATE: (id: string) => `/api/commerce/products/${id}/`,
    UPDATE_STOCK: (id: string) => `/api/commerce/products/${id}/update-stock`,
    DELETE: (id: string) => `/api/commerce/products/${id}/`,
    ADDONS: (productId: string) => `/api/commerce/products/${productId}/addons/`,
    ADDON_DETAIL: (productId: string, id: string) => `/api/commerce/products/${productId}/addons/${id}/`,
  },

  // Categories (Taxonomy) — no trailing slash so Next.js trailingSlash:false
  // does not issue a 308 redirect before the proxy can handle the request.
  CATEGORIES: {
    LIST: '/api/commerce/categories',
    DETAIL: (id: string) => `/api/commerce/categories/${id}`,
  },

  // Discovery — use /search/ for keyword queries (takes ?q=); products list
  // supports ?ordering, ?page, ?page_size, ?item_type, ?owner but NOT ?search.
  SEARCH: '/api/commerce/search/',
  VENDORS: '/api/commerce/vendors/',
  VENDOR_DETAIL: (id: string | number) => `/api/commerce/vendors/${id}/`,
  VENDOR_REVIEWS: '/api/commerce/vendors/reviews/',

  // Cart
  CART: {
    GET: '/api/commerce/cart/',
    ADD: '/api/commerce/cart/add/',
    CLEAR: '/api/commerce/cart/clear/',
    ITEM_DETAIL: (id: string) => `/api/commerce/cart/items/${id}/`,
  },

  // Orders
  ORDERS: {
    VENDOR_LIST: '/api/commerce/vendor/orders',
    LIST: '/api/commerce/orders',
    PLACE: '/api/commerce/orders/place',
    FILTER: '/api/commerce/orders/filter',
    HISTORY: '/api/commerce/orders/history',
    DETAIL: (id: string) => `/api/commerce/orders/filter?order_id=${id}`,
    UPDATE: (id: string) => `/api/commerce/orders/${id}/`,
    VENDOR_REVIEW: (id: string) => `/api/commerce/orders/${id}/vendor-review`,
    CUSTOMER_APPROVE: (id: string) => `/api/commerce/orders/${id}/customer-approve`,
    SET_SHIPPING: (id: string) => `/api/commerce/orders/${id}/set-shipping`,
    SET_SHIPPING_FEE: (id: string) => `/api/commerce/orders/${id}/set-shipping-fee`,
    PAYMENT_DECISION: (id: string) => `/api/commerce/orders/${id}/payment-decision`,
    START_DELIVERY: (id: string) => `/api/commerce/orders/${id}/start-delivery`,
    CONFIRM_HANDOVER: (id: string) => `/api/commerce/orders/${id}/confirm-handover`,
    RAISE_DISPUTE: (id: string) => `/staff/dispute/create/${id}`,
    DISPUTES: '/api/commerce/disputes/',
  },

  // Payments (Monnify)
  PAYMENTS: {
    INIT: '/api/payments/checkout/init',
    DIRECT_CHARGE: '/api/payments/direct-charge',
    BANK_TRANSFER: '/api/payments/bank-transfer',
    AUTHORIZE_OTP: '/api/payments/authorize-otp',
    HISTORY: '/api/payments/history',
    PENDING: '/api/payments/pending',
    STATUS: (txRef: string) => `/api/payments/status/${txRef}`,
    DETAIL: (txRef: string) => `/api/payments/detail/${txRef}`,
  },

  // Notifications
  NOTIFICATIONS: {
    LIST: '/api/notifications/notifications',
    DETAIL: (id: number) => `/api/notifications/notifications/${id}`,
    MARK_READ: (id: number) => `/api/notifications/notifications/${id}/mark_read`,
    MARK_ALL_READ: '/api/notifications/notifications/mark_all_read',
  },

  // Messages / DM
  MESSAGES: {
    LIST: '/api/posts/messages',
    THREAD: '/api/posts/messages/thread',
    DETAIL: (id: string) => `/api/posts/messages/${id}`,
  },

  REVIEWS: {
    LIST: '/api/commerce/vendors/reviews',
    CREATE: '/api/commerce/vendors/reviews',
    UPDATE: (id: number) => `/api/commerce/vendors/reviews/${id}`,
    DELETE: (id: number) => `/api/commerce/vendors/reviews/${id}`,
  },

  // Social - Posts
  POSTS: {
    LIST: '/api/socialposts',
    CREATE: '/api/socialposts',
    DETAIL: (id: number) => `/api/socialposts/${id}`,
    UPDATE: (id: number) => `/api/socialposts/${id}`,
    DELETE: (id: number) => `/api/socialposts/${id}`,
  },

  // Social - Likes
  LIKES: {
    CREATE: '/api/sociallikes',
    DELETE: (id: number) => `/api/sociallikes/${id}`,
  },

  // Social - Comments
  COMMENTS: {
    LIST: '/api/socialcomments/',
    CREATE: '/api/socialcomments/',
    UPDATE: (id: number) => `/api/socialcomments/${id}`,
    DELETE: (id: number) => `/api/socialcomments/${id}`,
  },

  // Social - Follows
  FOLLOWS: {
    CREATE: '/api/socialfollows',
    DELETE: (id: number) => `/api/socialfollows/${id}`,
  },

  // Transactions
  TRANSACTIONS: {
    LIST: '/api/commercetransactions/',
    DETAIL: (id: string) => `/api/commercetransactions/${id}`,
  },
};
