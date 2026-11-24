/**
 * Monnify web SDK (documented at developers.monnify.com/docs/monnify-checkout).
 * It opens Monnify's own payment modal over our page, so card data never touches our code or servers.
 * The apiKey passed in is Monnify's PUBLIC key (MK_...); the secret key stays on the backend.
 */
const SDK_URL = 'https://sdk.monnify.com/plugin/monnify.js';

interface SdkConfig {
  amount: number;
  currency: string;
  reference: string;
  customerFullName: string;
  customerEmail: string;
  apiKey: string;
  contractCode: string;
  paymentDescription?: string;
  metadata?: Record<string, unknown>;
  onLoadStart?: () => void;
  onLoadComplete?: () => void;
  onComplete?: (response: unknown) => void;
  onClose?: (data: unknown) => void;
}

declare global {
  interface Window {
    MonnifySDK?: { initialize: (cfg: SdkConfig) => void };
  }
}

let loading: Promise<void> | null = null;

export function loadMonnifySdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.MonnifySDK) return Promise.resolve();
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SDK_URL;
      s.async = true;
      s.onload = () => (window.MonnifySDK ? resolve() : reject(new Error('Monnify SDK did not initialise')));
      s.onerror = () => {
        loading = null;
        s.remove();
        reject(new Error('Could not load the payment window'));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export interface PrepareResult {
  tx_ref: string;
  amount: number;
  currency: string;
  customer_name: string;
  customer_email: string;
  description: string;
  api_key: string;
  contract_code: string;
}

/** Opens the modal. `onComplete` only means "the customer finished"; the order is paid when the webhook says so. */
export async function openMonnify(p: PrepareResult, cb: { onComplete: () => void; onClose: () => void }): Promise<void> {
  await loadMonnifySdk();
  window.MonnifySDK!.initialize({
    amount: p.amount,
    currency: p.currency,
    reference: p.tx_ref,
    customerFullName: p.customer_name,
    customerEmail: p.customer_email,
    apiKey: p.api_key,
    contractCode: p.contract_code,
    paymentDescription: p.description,
    onComplete: () => cb.onComplete(),
    onClose: () => cb.onClose(),
  });
}
