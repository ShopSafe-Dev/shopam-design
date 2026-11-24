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
      const fail = (msg: string) => {
        loading = null;
        s.remove();
        reject(new Error(msg));
      };
      // Never wait forever: an ad blocker, firewall or CSP can leave the request hanging.
      const timer = setTimeout(() => fail('The payment window took too long to load'), 12000);
      s.onload = () => {
        clearTimeout(timer);
        if (window.MonnifySDK) resolve();
        else fail('Monnify SDK loaded but did not initialise');
      };
      s.onerror = () => {
        clearTimeout(timer);
        fail('Could not load the payment window (blocked or offline)');
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
export async function openMonnify(
  p: PrepareResult,
  cb: { onComplete: () => void; onClose: () => void; onReady?: () => void }
): Promise<void> {
  await loadMonnifySdk();
  console.info('[pay] Monnify SDK loaded, opening modal', { reference: p.tx_ref, amount: p.amount, contract: p.contract_code, keyPrefix: String(p.api_key).slice(0, 8) });
  window.MonnifySDK!.initialize({
    onLoadStart: () => console.info('[pay] modal loading'),
    onLoadComplete: () => {
      console.info('[pay] modal ready');
      cb.onReady?.();
    },
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
