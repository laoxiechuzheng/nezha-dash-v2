"use client";

import { CheckIcon, LanguageIcon } from "@heroicons/react/20/solid";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
	const { t, i18n } = useTranslation();

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const locale = i18n.languages[0];

	const handleSelect = (e: Event, newLocale: string) => {
		e.preventDefault(); // 阻止默认的关闭行为
		i18n.changeLanguage(newLocale);
	};

	const localeItems = [
		{ name: t("language.zh-CN"), code: "zh-CN" },
		{ name: t("language.zh-TW"), code: "zh-TW" },
		{ name: t("language.en-US"), code: "en-US" },
		{ name: t("language.ru-RU"), code: "ru-RU" },
		{ name: t("language.es-ES"), code: "es-ES" },
		{ name: t("language.de-DE"), code: "de-DE" },
		{ name: t("language.ta-IN"), code: "ta-IN" },
	];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={cn("size-10 px-0 sm:size-9", {
						"bg-card/80": customBackgroundImage,
					})}
				>
					<LanguageIcon className="size-4" />
					<span className="sr-only">Change language</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="flex flex-col gap-0.5" align="end">
				{localeItems.map((item) => (
					<DropdownMenuItem
						key={item.code}
						onSelect={(e) => handleSelect(e, item.code)}
						className={cn("gap-3", {
							"bg-muted font-semibold": locale === item.code,
						})}
					>
						{item.name}{" "}
						{locale === item.code && (
							<CheckIcon className="size-4 text-primary" />
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
