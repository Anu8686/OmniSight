export type ThemePref = "light" | "dark" | "system";
export function getTheme(): ThemePref {
  try { const t = localStorage.getItem("omnisight-theme"); if (t === "dark" || t === "system") return t; } catch { /* storage unavailable */ }
  return "light";
}
export function applyTheme(t: ThemePref) {
  try { localStorage.setItem("omnisight-theme", t); } catch { /* storage unavailable */ }
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.setAttribute("data-theme", "dark"); else document.documentElement.removeAttribute("data-theme");
}
