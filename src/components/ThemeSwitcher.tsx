import { CheckIcon } from "@heroicons/react/20/solid";
import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Theme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { useTheme } from "../hooks/use-theme";

export function ModeToggle() {
	const { t } = useTranslation();
	const { setTheme, theme } = useTheme();

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const handleSelect = (e: Event, newTheme: Theme) => {
		e.preventDefault();
		setTheme(newTheme);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={cn("relative size-10 px-0 sm:size-9", {
						"bg-card/80": customBackgroundImage,
					})}
				>
					<Sun className="h-4 w-4 scale-100 transition-transform duration-150 dark:scale-0" />
					<Moon className="absolute h-4 w-4 scale-0 transition-transform duration-150 dark:scale-100" />
					<span className="sr-only">Toggle theme</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="flex flex-col gap-0.5" align="end">
				<DropdownMenuItem
					className={cn("gap-3", {
						"bg-muted font-semibold": theme === "light",
					})}
					onSelect={(e) => handleSelect(e, "light")}
				>
					{t("theme.light")}
					{theme === "light" && <CheckIcon className="size-4 text-primary" />}
				</DropdownMenuItem>
				<DropdownMenuItem
					className={cn("gap-3", {
						"bg-muted font-semibold": theme === "dark",
					})}
					onSelect={(e) => handleSelect(e, "dark")}
				>
					{t("theme.dark")}
					{theme === "dark" && <CheckIcon className="size-4 text-primary" />}
				</DropdownMenuItem>
				<DropdownMenuItem
					className={cn("gap-3", {
						"bg-muted font-semibold": theme === "system",
					})}
					onSelect={(e) => handleSelect(e, "system")}
				>
					{t("theme.system")}
					{theme === "system" && <CheckIcon className="size-4 text-primary" />}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
