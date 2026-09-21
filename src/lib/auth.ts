export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  message?: string;
}

// Temporary Mock Authentication Service (ready to be replaced with real Node.js/Nest API)
export const authApi = {
  async login({ email, password }: LoginCredentials): Promise<AuthResponse> {
    // Realistic network latency simulation
    await new Promise((resolve) => setTimeout(resolve, 650));

    // Basic client validation
    if (!email || !password) {
      throw new Error("Please enter both your email and password.");
    }

    // Mock validation
    if (password.length < 6) {
      throw new Error("We couldn't sign you in with those details. Please check your credentials.");
    }

    const mockUser: User = {
      id: "usr_01",
      firstName: email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1),
      lastName: "Guest",
      email,
      phone: "+2348012345678",
    };

    return {
      success: true,
      user: mockUser,
      message: "Signed in successfully.",
    };
  },

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    await new Promise((resolve) => setTimeout(resolve, 750));

    if (!credentials.email || !credentials.password || !credentials.firstName || !credentials.lastName) {
      throw new Error("Please fill in all required fields.");
    }

    if (credentials.password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }

    const mockUser: User = {
      id: `usr_${Date.now()}`,
      firstName: credentials.firstName,
      lastName: credentials.lastName,
      email: credentials.email,
      phone: credentials.phone,
    };

    return {
      success: true,
      user: mockUser,
      message: "Account created successfully.",
    };
  },

  async forgotPassword(email: string): Promise<AuthResponse> {
    await new Promise((resolve) => setTimeout(resolve, 550));

    if (!email || !email.includes("@")) {
      throw new Error("Please enter a valid email address.");
    }

    return {
      success: true,
      message: `If an account exists for ${email}, a reset link has been dispatched.`,
    };
  },

  async resetPassword({ password }: { password: string }): Promise<AuthResponse> {
    await new Promise((resolve) => setTimeout(resolve, 600));

    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }

    return {
      success: true,
      message: "Your password has been reset successfully.",
    };
  },
};
