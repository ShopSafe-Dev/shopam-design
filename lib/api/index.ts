// ---- Legacy hand-written services (unchanged) ----
export { authService } from './auth';
export { productsService, categoriesService } from './products';
export { variantsService } from './variants';
export type { VariantInput } from './variants';
export { vendorsService } from './vendors';
export type { Vendor } from './vendors';
export { notificationsService } from './notifications';
export { cartService } from './cart';
export {
  ordersService,
  postsService,
  likesService,
  commentsService,
  followsService,
  reviewsService,
  messagesService,
} from './services';
export { paymentsService } from './payments';

// ---- Config / env ----
export { default as apiClient, API_BASE_URL, API_ENDPOINTS } from './config';
export { API_IS_CROSS_ORIGIN, WS_URL } from './env';

export * from './types';

// ---- Full spec coverage (generated, one file per backend area) ----
// api.<area>.<operation>() e.g. api.commerce.cartRetrieve(). Needs patches 01-11 + 99.
export { api, toFormData } from './endpoints';
export type * as ApiSchema from './openapi-types';

// ---- Real-time chat (needs patch 12) ----
export { ReconnectingSocket } from './ws';
export type { SocketStatus, SocketOptions } from './ws';
export { useSocket } from './useSocket';

// ---- Cookie session user (needs patch 13) ----
export { useUser } from '../auth/useUser';
