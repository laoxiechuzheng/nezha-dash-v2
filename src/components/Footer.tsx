import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { fetchSetting } from "@/lib/nezha-api";

const Footer: React.FC = () => {
	const { t } = useTranslation();
	const isMac = /macintosh|mac os x/i.test(navigator.userAgent);

	const { data: settingData } = useQuery({
		queryKey: ["setting"],
		queryFn: () => fetchSetting(),
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		retry: false,
	});

	return (
		<footer className="server-footer mt-auto w-full border-t border-border">
			<section className="page-container server-footer-name flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground sm:flex-row">
				<div className="flex items-center gap-1.5">
					<span>&copy;2020-{new Date().getFullYear()}</span>
					<a
						href={"https://github.com/naiba/nezha"}
						target="_blank"
						rel="noopener"
						className="transition-colors hover:text-foreground"
					>
						Nezha
					</a>
					<p className="font-mono tabular-nums">
						{settingData?.data?.version || ""}
					</p>
				</div>
				<div className="server-footer-theme flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
					<span className="inline-flex items-center gap-1.5">
						<kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-[4px] border border-border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">
							{isMac ? <span className="text-xs">⌘</span> : "Ctrl "}K
						</kbd>
						<span>{t("footer.search")}</span>
					</span>
					<section>
						{t("footer.themeBy")}
						<a
							href={"https://github.com/hamster1963/nezha-dash"}
							target="_blank"
							rel="noopener"
							className="transition-colors hover:text-foreground"
						>
							nezha-dash
						</a>
						{import.meta.env.VITE_GIT_HASH && (
							<a
								href={`https://github.com/hamster1963/nezha-dash-v1/commit/${import.meta.env.VITE_GIT_HASH}`}
								className="ml-1 font-mono transition-colors hover:text-foreground"
							>
								({import.meta.env.VITE_GIT_HASH})
							</a>
						)}
					</section>
				</div>
			</section>
		</footer>
	);
};

export default Footer;
