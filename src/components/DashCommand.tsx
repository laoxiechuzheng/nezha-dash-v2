"use client";

import { Home, Moon, SearchX, Sun, SunMoon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import { useCommand } from "@/hooks/use-command";
import { useTheme } from "@/hooks/use-theme";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { saveMainPageScrollPosition } from "@/lib/navigation";
import { cn, formatNezhaInfo } from "@/lib/utils";

export function DashCommand() {
	const { isOpen, closeCommand, toggleCommand } = useCommand();
	const [search, setSearch] = useState("");
	const navigate = useNavigate();
	const { t } = useTranslation();
	const { setTheme } = useTheme();

	const { lastData, connected } = useWebSocketContext();

	const nezhaWsData = lastData;

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				toggleCommand();
			}
		};

		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, [toggleCommand]);

	const shortcuts = useMemo(
		() =>
			[
				{
					keywords: ["home", "homepage"],
					icon: <Home />,
					label: t("Home"),
					action: () => navigate("/"),
				},
				{
					keywords: ["light", "theme", "lightmode"],
					icon: <Sun />,
					label: t("ToggleLightMode"),
					action: () => setTheme("light"),
				},
				{
					keywords: ["dark", "theme", "darkmode"],
					icon: <Moon />,
					label: t("ToggleDarkMode"),
					action: () => setTheme("dark"),
				},
				{
					keywords: ["system", "theme", "systemmode"],
					icon: <SunMoon />,
					label: t("ToggleSystemMode"),
					action: () => setTheme("system"),
				},
			].map((item) => ({
				...item,
				value: `${item.keywords.join(" ")} ${item.label}`,
			})),
		[navigate, setTheme, t],
	);

	const serverCommands = useMemo(() => {
		if (!isOpen || !nezhaWsData) return [];

		return (nezhaWsData.servers ?? []).map((server) => ({
			id: server.id,
			name: server.name,
			online: formatNezhaInfo(nezhaWsData.now, server).online,
			platform: server.host.platform,
			country: server.country_code,
		}));
	}, [isOpen, nezhaWsData]);

	if (!connected || !nezhaWsData) return null;

	return (
		<CommandDialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) closeCommand();
			}}
		>
			<CommandInput
				placeholder={t("TypeCommand")}
				value={search}
				onValueChange={setSearch}
			/>
			<CommandList>
				<CommandEmpty>
					<span className="sh-empty-icon">
						<SearchX className="size-6" aria-hidden="true" />
					</span>
					<span>
						{search
							? t("v2Shell.search.empty", { query: search })
							: t("NoResults")}
					</span>
				</CommandEmpty>
				{serverCommands.length > 0 && (
					<CommandGroup heading={t("Servers")}>
						{serverCommands.map((server) => (
							<CommandItem
								key={server.id}
								value={server.name}
								onSelect={() => {
									saveMainPageScrollPosition();
									navigate(`/server/${server.id}`);
									closeCommand();
								}}
							>
								{server.country && (
									<span
										aria-hidden="true"
										className={`fi fi-${server.country.toLowerCase()} shrink-0 rounded-[3px]`}
									/>
								)}
								<span
									className="status-dot"
									data-status={server.online ? "online" : "offline"}
								/>
								<span
									className={cn(
										"min-w-0 flex-1 truncate",
										!server.online && "text-muted-foreground",
									)}
								>
									{server.name}
								</span>
								<span className="max-w-1/4 truncate text-xs text-muted-foreground">
									{server.platform}
								</span>
								<kbd className="kbd sh-command-enter">↵</kbd>
							</CommandItem>
						))}
					</CommandGroup>
				)}
				<CommandSeparator />

				<CommandGroup heading={t("v2Shell.search.pages")}>
					{shortcuts.slice(0, 1).map((item) => (
						<CommandItem
							key={item.label}
							value={item.value}
							onSelect={() => {
								item.action();
								closeCommand();
							}}
						>
							{item.icon}
							<span>{item.label}</span>
						</CommandItem>
					))}
				</CommandGroup>
				<CommandGroup heading={t("v2Shell.search.themes")}>
					{shortcuts.slice(1).map((item) => (
						<CommandItem
							key={item.label}
							value={item.value}
							onSelect={() => {
								item.action();
								closeCommand();
							}}
						>
							{item.icon}
							<span>{item.label}</span>
							<kbd className="kbd sh-command-enter ml-auto">↵</kbd>
						</CommandItem>
					))}
				</CommandGroup>
			</CommandList>
			<div className="sh-command-foot">
				<span>
					↑↓ {t("v2Shell.search.select")} · ↵ {t("v2Shell.search.open")}
				</span>
				<span>Esc {t("v2Shell.search.close")}</span>
			</div>
		</CommandDialog>
	);
}
