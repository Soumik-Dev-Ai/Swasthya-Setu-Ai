import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "./i18n";
import { login as apiLogin, refreshToken as apiRefresh, setRefreshHandler } from "./lib/api";

interface StoreState {
  theme: "light" | "dark";
  toggleTheme: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  online: boolean;
  setOnline: (v: boolean) => void;
  // Real JWT auth state (docs/25 §1). `token` is the access token.
  token: string | null;
  refreshToken: string | null;
  role: string | null;
  username: string | null;
  login: (token: string, refreshToken: string, role: string, username: string) => void;
  logout: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      theme: "light",
      toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      lang: "en",
      setLang: (lang) => set({ lang }),
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      setOnline: (online) => set({ online }),
      token: null,
      refreshToken: null,
      role: null,
      username: null,
      login: (token, refreshToken, role, username) => set({ token, refreshToken, role, username }),
      logout: () => set({ token: null, refreshToken: null, role: null, username: null }),
    }),
    {
      name: "ss-state",
      partialize: (s) => ({
        theme: s.theme,
        lang: s.lang,
        token: s.token,
        refreshToken: s.refreshToken,
        role: s.role,
        username: s.username,
      }),
    }
  )
);

/** Authenticate against the live backend. Throws ApiError on failure. */
export async function signIn(username: string, password: string) {
  const res = await apiLogin(username, password);
  useStore.getState().login(
    res.access_token,
    res.refresh_token ?? "",
    res.role,
    res.username,
  );
  return res;
}

export function signOut() {
  useStore.getState().logout();
}

/** Register the 401 auto-refresh hook (docs/25 §1 refresh flow). */
function installRefreshHandler() {
  setRefreshHandler(async () => {
    const { refreshToken, logout } = useStore.getState();
    if (!refreshToken) return null;
    try {
      const res = await apiRefresh(refreshToken);
      useStore.getState().login(res.access_token, res.refresh_token ?? "", res.role, res.username);
      return res.access_token;
    } catch {
      logout();
      return null;
    }
  });
}
installRefreshHandler();

/** Apply theme class + RTL dir + html lang whenever they change */
export function bindDocumentEffects() {
  const apply = () => {
    const { theme, lang } = useStore.getState();
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.setAttribute("dir", lang === "ur" ? "rtl" : "ltr");
    document.documentElement.lang = lang;
  };
  window.addEventListener("online", () => useStore.getState().setOnline(true));
  window.addEventListener("offline", () => useStore.getState().setOnline(false));
  apply();
  useStore.subscribe((s, prev) => {
    if (s.theme !== prev.theme || s.lang !== prev.lang) apply();
  });
}