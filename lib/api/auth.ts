import apiClient, { API_ENDPOINTS } from './config';
import { DEV_AUTH_BYPASS, DEV_USER } from '../devAuth';
import { getState, setUser, clearUser } from '../auth/session';
import { clearAccessToken, setAccessToken } from '../auth/token';
import type {
  UserRegister,
  VendorRegister,
  LoginRequest,
  LoginResponse,
  UserProfile,
  VendorProfile,
  FullProfile,
  PasswordChangeRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
  Bank,
  BankDetails,
  BankLookup,
} from './types';


export { clearRoleCookie } from '../auth/session';

let inflight: Promise<UserProfile | null> | null = null;

export const authService = {

  async registerUser(data: UserRegister): Promise<void> {
    await apiClient.post(API_ENDPOINTS.AUTH.USER_REGISTER, data);
  },

  async registerVendor(data: VendorRegister): Promise<void> {
    if (data.logo) {
      const form = new FormData();
      (Object.keys(data) as (keyof VendorRegister)[]).forEach((key) => {
        if (key === 'logo') return;
        const val = data[key];
        if (val !== undefined) form.append(key, val as string);
      });
      form.append('logo', data.logo);
      await apiClient.post(API_ENDPOINTS.AUTH.VENDOR_REGISTER, form);
    } else {
      const { logo: _logo, ...rest } = data;
      await apiClient.post(API_ENDPOINTS.AUTH.VENDOR_REGISTER, rest);
    }
  },


  async login(data: LoginRequest | { username: string; password: string }): Promise<LoginResponse> {
    const payload = 'username' in data && !('email' in data)
      ? { email: (data as any).username, password: data.password }
      : data;
    const response = await apiClient.post<any>(API_ENDPOINTS.AUTH.LOGIN, payload);
    // Body carries { user, access }. The access token stays in memory; the refresh token is an
    // HttpOnly cookie set by the backend and never visible here.
    const raw = response.data;
    const user: UserProfile = raw.user ?? raw;
    setAccessToken(raw.access);
    setUser(user);
    return { access: '', refresh: '', user };
  },


  async logout(): Promise<void> {
    try {
      // Backend blacklists this device's refresh token and clears the cookie.
      await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
    } finally {
      clearAccessToken();
      clearUser();
    }
  },


  async changePassword(data: PasswordChangeRequest): Promise<void> {
    // The spec marks old_password1 as required alongside old_password; send the same value.
    const res = await apiClient.post<{ access?: string }>(API_ENDPOINTS.AUTH.PASSWORD_CHANGE, {
      old_password1: data.old_password,
      ...data,
    });
    // Every other device was signed out; this one gets a fresh token pair.
    if (res.data?.access) setAccessToken(res.data.access);
  },

  /**
   * Get current user profile
   */
  async getProfile(): Promise<UserProfile> {
    const response = await apiClient.get<any>(API_ENDPOINTS.AUTH.PROFILE);
    // API returns { user: {...}, profile: {...} } — extract user
    return response.data?.user ?? response.data;
  },

  /** Sync check against the cached user. Use ensureUser() when you need server truth. */
  isAuthenticated(): boolean {
    if (DEV_AUTH_BYPASS) return true;
    return getState().user !== null;
  },

  /** Cached user (memory / sessionStorage snapshot). May be stale until ensureUser() settles. */
  getCurrentUser(): UserProfile | null {
    if (DEV_AUTH_BYPASS) return DEV_USER;
    return getState().user;
  },

  /**
   * Resolve the signed-in user (refreshing the access token first if needed) via GET /api/accounts/profile.
   * Deduplicated; resolves null for guests. Pass { force: true } to re-check the server.
   */
  async ensureUser(opts?: { force?: boolean }): Promise<UserProfile | null> {
    if (DEV_AUTH_BYPASS) return DEV_USER;
    const s = getState();
    if (!opts?.force && s.status !== 'unknown') return s.user;
    if (!inflight) {
      inflight = (async () => {
        try {
          const response = await apiClient.get<any>(API_ENDPOINTS.AUTH.PROFILE);
          const user: UserProfile = response.data?.user ?? response.data;
          setUser(user);
          return user;
        } catch (err: any) {
          if (err?.response?.status === 401) {
            clearUser();
            return null;
          }
          return getState().user; // network/5xx: cannot tell, keep what we have
        } finally {
          inflight = null;
        }
      })();
    }
    return inflight;
  },

  /**
   * Send password reset link to email
   */
  async forgotPassword(data: ForgotPasswordRequest): Promise<void> {
    await apiClient.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, data);
  },

  /**
   * Reset password using token from email link
   */
  async resetPassword(data: ResetPasswordRequest): Promise<void> {
    await apiClient.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, data);
  },


  /**
   * Re-send the verification link (rate-limited to 3/hour by the backend).
   * NOTE: POST /api/accounts/email-verify-send is session-protected in the middleware, and an
   * unverified user has no session, so for them this answers 401 until the backend allows it
   * publicly. The email is sent in the body for that case.
   */
  async resendVerification(email?: string): Promise<void> {
    await apiClient.post('/api/accounts/email-verify-send', email ? { email } : undefined);
  },

  async verifyEmail(token: string): Promise<{ authenticated: boolean }> {
    try {
      const response = await apiClient.get<any>(API_ENDPOINTS.AUTH.VERIFY_EMAIL, { params: { token } });
      const raw = response.data ?? {};

      // Backend returns { message: "Email verified successfully." } on 200
      if (raw.message) {
        return { authenticated: false };
      }

      // Shouldn't reach here on a 200, but just in case
      throw new Error('Verification failed.');
    } catch (err: any) {
      // Axios throws on 4xx — pull the error message from the response body
      const message = err?.response?.data?.error ?? 'Verification link is invalid or has expired.';
      throw new Error(message);
    }
  },
  /**
   * Fetch the full profile from the server and refresh the cached user
   */
  async refreshProfile(): Promise<UserProfile> {
    const response = await apiClient.get<any>(API_ENDPOINTS.AUTH.PROFILE);
    const profile: UserProfile = response.data?.user ?? response.data;
    setUser(profile);
    return profile;
  },

  /**
   * Fetch user + vendor business profile together.
   * API returns { user: {...}, vendor_profile: {...} } for vendors.
   */
  async getFullProfile(): Promise<FullProfile> {
    const response = await apiClient.get<any>(API_ENDPOINTS.AUTH.PROFILE);
    const raw = response.data ?? {};
    const user: UserProfile = raw.user ?? raw;
    const vendor_profile: VendorProfile | undefined = raw.vendor_profile ?? raw.profile ?? undefined;
    setUser(user);
    return { user, vendor_profile };
  },

  /** Banks supported for payouts (Monnify list, cached by the server). */
  async getBanks(): Promise<Bank[]> {
    return (await apiClient.get<Bank[]>(API_ENDPOINTS.AUTH.BANKS)).data;
  },

  /** Look up the account name for a number + bank. The server holds the result for 10 minutes. */
  async resolveBankAccount(accountNumber: string, bankCode: string): Promise<BankLookup> {
    return (await apiClient.post<BankLookup>(API_ENDPOINTS.AUTH.BANK_RESOLVE, { account_number: accountNumber, bank_code: bankCode })).data;
  },

  /** Vendor confirms the looked-up account is theirs. `password` is required when replacing a verified account. */
  async confirmBankAccount(accountNumber: string, bankCode: string, password?: string): Promise<BankDetails> {
    const res = await apiClient.post<{ bank_details: BankDetails }>(API_ENDPOINTS.AUTH.BANK_CONFIRM, {
      account_number: accountNumber,
      bank_code: bankCode,
      confirm: true,
      ...(password ? { password } : {}),
    });
    return res.data.bank_details;
  },

  /** Upload (or replace) the vendor logo. Returns the vendor profile with a signed logo URL. */
  async uploadVendorLogo(file: File): Promise<VendorProfile> {
    const form = new FormData();
    form.append('logo', file);
    const res = await apiClient.post<VendorProfile>(API_ENDPOINTS.AUTH.VENDOR_LOGO, form);
    return res.data;
  },

  async removeVendorLogo(): Promise<VendorProfile> {
    const res = await apiClient.delete<VendorProfile>(API_ENDPOINTS.AUTH.VENDOR_LOGO);
    return res.data;
  },

  /**
   * Partially update the authenticated user's profile
   */
  async updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
    const response = await apiClient.patch<UserProfile>(
      API_ENDPOINTS.AUTH.PROFILE_UPDATE,
      data
    );
    setUser(response.data);
    return response.data;
  },

  /**
   * Soft-delete the authenticated user's account
   */
  async deactivateAccount(): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.AUTH.PROFILE_DEACTIVATE);
    clearAccessToken();
    clearUser();
  },
};
