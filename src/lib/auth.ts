export interface User {
  id: string;
  email: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
  phone?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  status?: string;
  profile?: any;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
}

export interface RegisterOwnerCredentials {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  password: string;
  hostType?: "individual_owner" | "property_manager" | "company";
  companyName?: string;
  operatingCity?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}

export const authApi = {
  async login({ email, password }: LoginCredentials): Promise<AuthResponse> {
    if (!email || !password) {
      throw new Error("Please enter both your email and password.");
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Unable to connect to the authentication service. Please check your network and try again.");
        }
        const errorMsg = data?.error || data?.message;
        if (!errorMsg || errorMsg === "Not Found") {
          throw new Error("We couldn't sign you in with those details. Please check your credentials.");
        }
        throw new Error(errorMsg);
      }

      if (typeof window !== "undefined" && data.token) {
        localStorage.setItem("ile_token", data.token);
        localStorage.setItem("ile_user", JSON.stringify(data.user));
      }

      return {
        success: true,
        user: data.user,
        token: data.token,
        message: "Signed in successfully.",
      };
    } catch (err: any) {
      throw new Error(err.message || "Failed to sign in. Please try again.");
    }
  },

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    if (!credentials.email || !credentials.password || !credentials.firstName || !credentials.lastName) {
      throw new Error("Please fill in all required fields.");
    }

    if (credentials.password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(credentials),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Unable to connect to registration service. Please try again.");
        }
        const errorMsg = data?.error || data?.message;
        if (!errorMsg || errorMsg === "Not Found") {
          throw new Error("Registration failed. Please try again.");
        }
        throw new Error(errorMsg);
      }

      if (typeof window !== "undefined" && data.token) {
        localStorage.setItem("ile_token", data.token);
        localStorage.setItem("ile_user", JSON.stringify(data.user));
      }

      return {
        success: true,
        user: data.user,
        token: data.token,
        message: data.message || "Account created successfully.",
      };
    } catch (err: any) {
      throw new Error(err.message || "Registration failed. Please try again.");
    }
  },

  async registerOwner(credentials: RegisterOwnerCredentials): Promise<AuthResponse> {
    if (!credentials.email || !credentials.password) {
      throw new Error("Please enter your email and password.");
    }
    if (!credentials.firstName && !credentials.fullName) {
      throw new Error("Please enter your legal name.");
    }

    if (credentials.password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }

    try {
      const res = await fetch("/api/auth/register-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(credentials),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Unable to reach the Ilé authentication service. Please check your network connection and try again.");
        }
        const errorMsg = data?.error || data?.message;
        if (!errorMsg || errorMsg === "Not Found") {
          throw new Error("Unable to create owner account at this time. Please try again.");
        }
        throw new Error(errorMsg);
      }

      if (typeof window !== "undefined" && data.token) {
        localStorage.setItem("ile_token", data.token);
        localStorage.setItem("ile_user", JSON.stringify(data.user));
      }

      return {
        success: true,
        user: data.user,
        token: data.token,
        message: data.message || "Owner account created.",
      };
    } catch (err: any) {
      throw new Error(err.message || "Owner registration failed. Please try again.");
    }
  },

  async verifyEmail(code: string): Promise<any> {
    const token = typeof window !== "undefined" ? localStorage.getItem("ile_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ code }),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error("Unable to reach the verification service. Please try again.");
      }
      const msg = data?.error || data?.message;
      if (!msg || msg === "Not Found") {
        throw new Error("Email verification failed. Please check your code.");
      }
      throw new Error(msg);
    }
    return data;
  },

  async resendEmailOtp(): Promise<any> {
    const token = typeof window !== "undefined" ? localStorage.getItem("ile_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch("/api/auth/resend-email-otp", {
      method: "POST",
      headers,
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to resend code.");
    return data;
  },

  async sendPhoneOtp(phone: string): Promise<any> {
    const token = typeof window !== "undefined" ? localStorage.getItem("ile_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch("/api/auth/send-phone-otp", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ phone }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to send SMS code.");
    return data;
  },

  async verifyPhone(code: string): Promise<any> {
    const token = typeof window !== "undefined" ? localStorage.getItem("ile_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch("/api/auth/verify-phone", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ code }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Phone verification failed.");
    return data;
  },

  async me(): Promise<User | null> {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("ile_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/auth/me", {
        credentials: "include",
        headers,
      });

      if (!res.ok) return null;
      const data = await res.json();
      return data.user;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("ile_token");
        localStorage.removeItem("ile_user");
      }
    }
  },

  async forgotPassword(email: string): Promise<AuthResponse> {
    if (!email || !email.includes("@")) {
      throw new Error("Please enter a valid email address.");
    }

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to process request.");

    return {
      success: true,
      message: data.message || `If an account exists for ${email}, a reset link has been dispatched.`,
    };
  },

  async resetPassword({ token, password }: { token: string; password: string }): Promise<AuthResponse> {
    if (!token) {
      throw new Error("Password reset token is missing. Please use the link provided in your email.");
    }
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Password reset failed. Please request a new link.");
    }

    return {
      success: true,
      message: data.message || "Your password has been reset successfully.",
    };
  },
};
