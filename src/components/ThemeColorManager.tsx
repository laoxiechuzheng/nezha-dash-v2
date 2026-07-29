"use client";

import { useEffect } from "react";
import { useTheme } from "@/hooks/use-theme";

export function ThemeColorManager() {
	const { theme } = useTheme();

	useEffect(() => {
		const updateThemeColor = () => {
			const currentTheme =
				theme === "system"
					? window.matchMedia("(prefers-color-scheme: dark)").matches
						? "dark"
						: "light"
					: theme;
			const meta = document.querySelector('meta[name="theme-color"]');

			if (!meta) {
				const newMeta = document.createElement("meta");
				newMeta.name = "theme-color";
				document.head.appendChild(newMeta);
			}

			const themeColor =
				currentTheme === "dark" ? "hsl(222 47% 7%)" : "hsl(216 33% 97%)";

			document
				.querySelector('meta[name="theme-color"]')
				?.setAttribute("content", themeColor);
		};

		// Update on mount and theme change
		updateThemeColor();

		// Listen for system theme changes
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		mediaQuery.addEventListener("change", updateThemeColor);

		return () => mediaQuery.removeEventListener("change", updateThemeColor);
	}, [theme]);

	return null;
}
