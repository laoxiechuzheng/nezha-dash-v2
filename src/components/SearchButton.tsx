"use client";

import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { useTranslation } from "react-i18next";
import { useCommand } from "@/hooks/use-command";
import { cn } from "@/lib/utils";

import { Button } from "./ui/button";

export function SearchButton() {
	const { t } = useTranslation();
	const { openCommand } = useCommand();
	const isMac =
		typeof navigator !== "undefined" &&
		/macintosh|mac os x/i.test(navigator.userAgent);

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	return (
		<Button
			variant="outline"
			size="sm"
			className={cn(
				"size-10 px-0 text-muted-foreground sm:size-9 md:h-9 md:w-52 md:justify-start md:gap-2 md:px-2.5",
				{
					"bg-card/80": customBackgroundImage,
				},
			)}
			onClick={openCommand}
			title="Search"
			aria-label="Search"
		>
			<MagnifyingGlassIcon className="size-4" />
			<span className="sr-only">Search</span>
			<span
				aria-hidden="true"
				className="hidden flex-1 text-left font-normal md:inline"
			>
				{t("header.searchPlaceholder")}
			</span>
			<kbd className="pointer-events-none hidden h-5 items-center rounded-[4px] border border-border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground md:inline-flex">
				{isMac ? "⌘" : "Ctrl"} K
			</kbd>
		</Button>
	);
}
