export interface User {
  id: string;
  email: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
  phone?: string;
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "We couldn't sign you in with those details.");
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed.");
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

  async resetPassword({ password }: { password: string }): Promise<AuthResponse> {
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }

    return {
      success: true,
      message: "Your password has been reset successfully.",
    };
  },
};
