import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/use-theme";
import { fetchSetting } from "@/lib/nezha-api";

const Footer: React.FC = () => {
	const { t } = useTranslation();
	const { theme } = useTheme();
	const isMac = /macintosh|mac os x/i.test(navigator.userAgent);
	const { data: settingData } = useQuery({
		queryKey: ["setting"],
		queryFn: () => fetchSetting(),
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		retry: false,
	});

	return (
		<footer className="server-footer sh-footer mt-auto w-full">
			<section className="page-container server-footer-name sh-footer-inner">
				<div className="num flex flex-wrap items-center justify-center gap-1.5 font-mono">
					<span>&copy;2020-{new Date().getFullYear()}</span>
					<a
						href="https://github.com/naiba/nezha"
						target="_blank"
						rel="noopener noreferrer"
						className="hover:text-foreground"
					>
						Nezha
					</a>
					<span>{settingData?.data?.version || ""}</span>
				</div>
				<div className="server-footer-theme flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
					<span className="inline-flex items-center gap-1.5">
						<kbd className="kbd">{isMac ? "⌘" : "Ctrl"} K</kbd>
						{t("footer.search")}
						<span aria-hidden="true">·</span>
						{t(`theme.${theme}`)}
					</span>
					<span className="text-[11px]">
						{t("footer.themeBy")}
						<a
							href="https://github.com/hamster1963/nezha-dash"
							target="_blank"
							rel="noopener noreferrer"
						>
							nezha-dash
						</a>
						{import.meta.env.VITE_GIT_HASH && (
							<a
								href={`https://github.com/hamster1963/nezha-dash-v1/commit/${import.meta.env.VITE_GIT_HASH}`}
							>
								({import.meta.env.VITE_GIT_HASH})
							</a>
						)}
					</span>
				</div>
			</section>
		</footer>
	);
};
export default Footer;
