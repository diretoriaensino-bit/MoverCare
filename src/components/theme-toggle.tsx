"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("theme-dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem("movercare-theme", theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("movercare-theme") as Theme | null;
    const initialTheme = savedTheme === "dark" ? "dark" : "light";

    setTheme(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  if (!mounted) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-2xl border border-[#009da8]/30 bg-white px-4 py-3 text-sm font-black text-[#009da8] shadow-sm transition hover:bg-[#009da8]/10"
      aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
    >
      {theme === "dark" ? "☀️ Modo claro" : "🌙 Modo escuro"}
    </button>
  );
}