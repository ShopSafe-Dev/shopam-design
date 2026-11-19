import apiClient, { API_ENDPOINTS } from './config';
import { DEV_AUTH_BYPASS, DEV_USER } from '../devAuth';
import { getState, setUser, clearUser } from '../auth/session';
import { clearMode } from '../auth/mode';
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
    // The backend middleware moves the JWTs into an HttpOnly cookie and strips them from
    // the body, so only the user comes back. Nothing secret is stored here.
    const raw = response.data;
    const user: UserProfile = raw.user ?? raw;
    setUser(user);
    return { access: '', refresh: '', user };
  },


  async logout(): Promise<void> {
    try {
      // Backend deletes the Redis session + cookie.
      await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
    } finally {
      clearUser();
      clearMode();
    }
  },


  async changePassword(data: PasswordChangeRequest): Promise<void> {
    // The spec marks old_password1 as required alongside old_password; send the same value.
    await apiClient.post(API_ENDPOINTS.AUTH.PASSWORD_CHANGE, { old_password1: data.old_password, ...data });
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
   * Resolve the signed-in user from the cookie session via GET /api/accounts/profile.
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
    clearUser();
    clearMode();
  },
};
