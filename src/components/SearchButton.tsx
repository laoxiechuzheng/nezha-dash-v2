"use client";

import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCommand } from "@/hooks/use-command";
import { Button } from "./ui/button";

export function SearchButton() {
	const { t } = useTranslation();
	const { openCommand } = useCommand();
	const isMac =
		typeof navigator !== "undefined" &&
		/macintosh|mac os x/i.test(navigator.userAgent);

	return (
		<Button
			variant="outline"
			className="sh-search-trigger"
			onClick={openCommand}
			title={t("v2Shell.search.label")}
			aria-label={t("v2Shell.search.label")}
		>
			<Search className="size-[18px]" aria-hidden="true" />
			<span
				aria-hidden="true"
				className="hidden min-w-0 flex-1 truncate text-left font-normal text-muted-foreground lg:inline"
			>
				{t("header.searchPlaceholder")}
			</span>
			<kbd className="kbd hidden lg:inline-flex">{isMac ? "⌘" : "Ctrl"} K</kbd>
		</Button>
	);
}
