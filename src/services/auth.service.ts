import api from "./api";

interface RegisterData {
  name: string;
  email: string;
  password: string;
}

interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export const register = async (data: RegisterData) => {
  const response = await api.post("/auth/register", data);
  return response.data;
};

export const login = async (data: LoginData) => {
  const response = await api.post("/auth/login", data);

  const { token } = response.data;

  if (token) {
    if (data.rememberMe !== false) {
      localStorage.setItem("token", token);
      sessionStorage.removeItem("token");
    } else {
      sessionStorage.setItem("token", token);
      localStorage.removeItem("token");
    }
  }

  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/auth/me");
  return response.data;
};

export const logout = () => {
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
};

export const verifyEmail = async (token: string) => {
  const response = await api.get("/auth/verify-email", {
    params: {
      token,
    },
  });

  return response.data;
};

export const resetPassword = async (
  token: string,
  newPassword: string
) => {
  const response = await api.post("/auth/reset-password", {
    token,
    newPassword,
  });

  return response.data;
};
export const forgotPassword = async (email: string) => {
  const response = await api.post("/auth/forgot-password", {
    email,
  });

  return response.data;
};

export const changePassword = async (data: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> => {
  const response = await api.put("/auth/change-password", data);
  return response.data;
};

export const getOAuthUrl = (provider: "google" | "github"): string => {
  const base = api.defaults.baseURL || "http://localhost:5000/api";
  return `${base}/auth/${provider}`;
};

export const exchangeOAuthCode = async (code: string) => {
  const response = await api.post("/auth/oauth/exchange", { code });
  return response.data;
};