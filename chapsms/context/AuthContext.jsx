"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authService } from "@/services/auth.service";
import { getAcquisition, trackSnapSignUp } from "@/lib/acquisition";

const AuthContext = createContext(null);
const TOKEN_KEYS = ["chapsms-token", "chapsms_token", "authToken", "token"];
export const LOGIN_ANNOUNCEMENT_KEY = "chapsms:show-login-announcement";

function getStoredToken() {
  if (typeof window === "undefined") return "";
  for (const key of TOKEN_KEYS) {
    const persistent = window.localStorage.getItem(key);
    if (persistent) return persistent;
  }
  for (const key of TOKEN_KEYS) {
    const temporary = window.sessionStorage.getItem(key);
    if (temporary) return temporary;
  }
  return "";
}

function clearStoredTokens() {
  if (typeof window === "undefined") return;
  for (const key of TOKEN_KEYS) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
}

function storeToken(token, rememberMe) {
  if (typeof window === "undefined") return;
  clearStoredTokens();
  const storage = rememberMe ? window.localStorage : window.sessionStorage;
  for (const key of TOKEN_KEYS) storage.setItem(key, token);
}

function queueLoginAnnouncement(user) {
  if (typeof window === "undefined" || !user || user?.role === "admin") return;
  try {
    window.sessionStorage.setItem(LOGIN_ANNOUNCEMENT_KEY, JSON.stringify({
      createdAt: Date.now(),
      userId: String(user?._id || user?.id || user?.email || ""),
    }));
  } catch { /* Storage failure must not block login. */ }
}

function clearLoginAnnouncement() {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(LOGIN_ANNOUNCEMENT_KEY); } catch {}
}

function notifyAuthChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("chapsms-auth-change"));
}

// Deduplicate signup events by user ID, rather than by browser or provider.
// The caller must supply a confirmed NEW account, not a login or a session refresh.
function trackNewAccount(response) {
  if (typeof window === "undefined") return;
  const user = response?.user;
  const id = String(user?._id || user?.id || "").trim();
  if (!id || user?.role === "admin") return;
  const key = `chapsms_snap_signup_${id}`;
  try {
    if (window.localStorage.getItem(key)) return;
  } catch {}
  // Don't mark an event sent unless the pixel SDK exists.
  if (typeof window.snaptr !== "function") return;
  try {
    trackSnapSignUp();
    try { window.localStorage.setItem(key, "1"); } catch {}
  } catch (error) {
    console.warn("Snapchat signup tracking failed:", error);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const sessionGenerationRef = useRef(0);

  const establishSession = useCallback((response, rememberMe = true) => {
    const nextToken = String(response?.token || "").trim();
    if (!nextToken) {
      const error = new Error("The server did not return an authentication token");
      error.code = "AUTH_TOKEN_MISSING";
      throw error;
    }
    sessionGenerationRef.current += 1;
    storeToken(nextToken, rememberMe);
    setToken(nextToken);
    setUser(response?.user || null);
    setAuthLoading(false);
    queueLoginAnnouncement(response?.user);
    notifyAuthChanged();
    return response;
  }, []);

  const logout = useCallback(async () => {
    sessionGenerationRef.current += 1;
    clearStoredTokens();
    clearLoginAnnouncement();
    setToken("");
    setUser(null);
    setAuthLoading(false);
    notifyAuthChanged();
  }, []);

  const refreshUser = useCallback(async (explicitToken) => {
    const activeToken = explicitToken || token || getStoredToken();
    if (!activeToken) { setUser(null); return null; }
    const response = await authService.getMe(activeToken);
    const nextUser = response?.user || null;
    setToken(activeToken);
    setUser(nextUser);
    return nextUser;
  }, [token]);

  useEffect(() => {
    let active = true;
    const restoreGeneration = sessionGenerationRef.current;
    async function restoreSession() {
      const storedToken = getStoredToken();
      if (!storedToken) {
        if (active && sessionGenerationRef.current === restoreGeneration) setAuthLoading(false);
        return;
      }
      try {
        let response;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try { response = await authService.getMe(storedToken); break; }
          catch (error) {
            const transient = error?.code === "NETWORK_ERROR" || error?.code === "REQUEST_TIMEOUT" || (Number(error?.status) >= 500 && Number(error?.status) < 600);
            if (!transient || attempt === 2) throw error;
            await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
            if (!active || sessionGenerationRef.current !== restoreGeneration) return;
          }
        }
        if (!active || sessionGenerationRef.current !== restoreGeneration) return;
        setToken(storedToken);
        setUser(response?.user || null);
      } catch (error) {
        if (!active || sessionGenerationRef.current !== restoreGeneration) return;
        console.error("Session restoration failed:", error);
        if (error?.status === 401 || error?.status === 403) {
          clearStoredTokens();
          clearLoginAnnouncement();
          setToken("");
          setUser(null);
        } else {
          setToken(storedToken);
          setUser(null);
        }
      } finally {
        if (active && sessionGenerationRef.current === restoreGeneration) setAuthLoading(false);
      }
    }
    restoreSession();
    return () => { active = false; };
  }, []);

  const signup = useCallback(async (payload) => {
    const response = await authService.register({ ...payload, ...getAcquisition() });
    // A successful register response represents a newly created account.
    // If your backend creates an unverified pending account, decide whether
    // to move this call to the email-verification success handler instead.
    trackNewAccount(response);
    // With email verification off the account is ready and comes with a token.
    if (response?.token) return establishSession(response, true);
    return response;
  }, [establishSession]);

  const login = useCallback(async (payload) => {
    const response = await authService.login({ email: payload.email, password: payload.password });
    return establishSession(response, payload.rememberMe !== false);
  }, [establishSession]);

  const googleLogin = useCallback(async (credential, { rememberMe = true } = {}) => {
    const response = await authService.google(credential, getAcquisition());
    const result = establishSession(response, rememberMe);
    // Existing Google users must NEVER generate another SIGN_UP event.
    if (response?.isNewUser === true) trackNewAccount(response);
    return result;
  }, [establishSession]);

  const updateUser = useCallback((value) => {
    setUser((current) => typeof value === "function" ? value(current) : value);
  }, []);

  const value = useMemo(() => ({
    user, token, authLoading, isAuthenticated: Boolean(user && token),
    signup, register: signup, login, googleLogin, logout,
    refreshUser, refreshAuth: refreshUser, setUser: updateUser, updateUser,
  }), [user, token, authLoading, signup, login, googleLogin, logout, refreshUser, updateUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export default AuthContext;
