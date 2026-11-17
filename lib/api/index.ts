export { authService } from './auth';
export { productsService, categoriesService } from './products';
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

// Export API config
export { default as apiClient, API_BASE_URL, API_ENDPOINTS } from './config';

export * from './types';

// Full spec coverage (generated): api.<area>.<operation>() for every URL.
export { api, toFormData } from './endpoints';
export type * as ApiSchema from './openapi-types';
export { ReconnectingSocket } from './ws';
export type { SocketStatus, SocketOptions } from './ws';
export { useSocket } from './useSocket';