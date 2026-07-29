import {
	ArrowDownCircleIcon,
	ArrowUpCircleIcon,
} from "@heroicons/react/20/solid";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { useStatus } from "@/hooks/use-status";
import { formatBytes } from "@/lib/format";
import { bytesPerSecondToMbps, cn, formatMbps } from "@/lib/utils";
import NumericText from "./NumericText";

type ServerOverviewProps = {
	online: number;
	offline: number;
	total: number;
	up: number;
	down: number;
	upSpeed: number;
	downSpeed: number;
};

export default function ServerOverview({
	online,
	offline,
	total,
	up,
	down,
	upSpeed,
	downSpeed,
}: ServerOverviewProps) {
	const { t } = useTranslation();
	const { status, setStatus } = useStatus();

	// @ts-expect-error DisableAnimatedMan is a global variable
	const disableAnimatedMan = window.DisableAnimatedMan as boolean;

	// @ts-expect-error CustomIllustration is a global variable
	const customIllustration = window.CustomIllustration || "/animated-man.webp";

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	return (
		<section className="server-overview grid grid-cols-2 gap-3 lg:grid-cols-4">
			<Card
				onClick={() => {
					setStatus("all");
				}}
				className={cn(
					"group relative min-h-28 cursor-pointer overflow-hidden border-sky-500/15 bg-gradient-to-br from-sky-500/12 via-white/72 to-blue-500/6 hover:-translate-y-1 hover:border-sky-400/45 hover:shadow-[0_26px_65px_-34px_rgba(14,165,233,0.75)] dark:via-slate-950/62",
					{
						"bg-card/70": customBackgroundImage,
					},
				)}
			>
				<CardContent className="flex h-full items-center px-5 py-5">
					<section className="flex flex-col gap-1">
						<p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
							{t("serverOverview.totalServers")}
						</p>
						<div className="flex items-center gap-2">
							<span className="relative flex h-2 w-2">
								<span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
							</span>
							<NumericText
								value={total}
								className="text-3xl font-black tracking-tight"
							/>
						</div>
					</section>
				</CardContent>
			</Card>
			<Card
				onClick={() => {
					setStatus("online");
				}}
				className={cn(
					"group relative min-h-28 cursor-pointer overflow-hidden border-emerald-500/15 bg-gradient-to-br from-emerald-500/12 via-white/72 to-teal-500/6 hover:-translate-y-1 hover:border-emerald-400/45 hover:shadow-[0_26px_65px_-34px_rgba(16,185,129,0.75)] dark:via-slate-950/62",
					{
						"bg-card/70": customBackgroundImage,
					},
					{
						"border-transparent ring-2 ring-green-500 dark:ring-green-600":
							status === "online",
					},
				)}
			>
				<CardContent className="flex h-full items-center px-5 py-5">
					<section className="flex flex-col gap-1">
						<p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
							{t("serverOverview.onlineServers")}
						</p>
						<div className="flex items-center gap-2">
							<span className="relative flex h-2 w-2">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
								<span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
							</span>
							<NumericText
								value={online}
								className="text-3xl font-black tracking-tight"
							/>
						</div>
					</section>
				</CardContent>
			</Card>
			<Card
				onClick={() => {
					setStatus("offline");
				}}
				className={cn(
					"group relative min-h-28 cursor-pointer overflow-hidden border-rose-500/15 bg-gradient-to-br from-rose-500/11 via-white/72 to-orange-500/5 hover:-translate-y-1 hover:border-rose-400/45 hover:shadow-[0_26px_65px_-34px_rgba(244,63,94,0.7)] dark:via-slate-950/62",
					{
						"bg-card/70": customBackgroundImage,
					},
					{
						"border-transparent ring-2 ring-red-500 dark:ring-red-600":
							status === "offline",
					},
				)}
			>
				<CardContent className="flex h-full items-center px-5 py-5">
					<section className="flex flex-col gap-1">
						<p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
							{t("serverOverview.offlineServers")}
						</p>
						<div className="flex items-center gap-2">
							<span className="relative flex h-2 w-2">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75"></span>
								<span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
							</span>
							<NumericText
								value={offline}
								className="text-3xl font-black tracking-tight"
							/>
						</div>
					</section>
				</CardContent>
			</Card>
			<Card
				className={cn(
					"group relative min-h-28 overflow-hidden border-indigo-500/15 bg-gradient-to-br from-indigo-500/12 via-white/72 to-violet-500/6 hover:-translate-y-1 hover:border-indigo-400/45 hover:shadow-[0_26px_65px_-34px_rgba(99,102,241,0.75)] dark:via-slate-950/62",
					{
						"bg-card/70": customBackgroundImage,
					},
				)}
			>
				<CardContent className="relative flex h-full items-center px-4 py-4 sm:px-5">
					<section className="z-10 flex w-full flex-col gap-2">
						<div className="flex w-full items-center justify-between">
							<p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
								{t("serverOverview.network")}
							</p>
							<span className="rounded-full border border-indigo-500/15 bg-indigo-500/8 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">
								Live
							</span>
						</div>
						<section className="grid grid-cols-2 gap-2">
							<p className="flex min-w-0 flex-col rounded-xl border border-sky-500/12 bg-sky-500/7 px-2.5 py-2 text-nowrap">
								<span className="mb-0.5 flex items-center text-[9px] font-semibold text-slate-500 dark:text-slate-400">
									<ArrowUpCircleIcon className="mr-1 size-3 text-sky-500" />
									上传
								</span>
								<span className="text-[11px] font-black tracking-tight text-sky-700 dark:text-sky-300 sm:text-xs">
									{formatMbps(bytesPerSecondToMbps(upSpeed))}
								</span>
							</p>
							<p className="flex min-w-0 flex-col rounded-xl border border-violet-500/12 bg-violet-500/7 px-2.5 py-2 text-nowrap">
								<span className="mb-0.5 flex items-center text-[9px] font-semibold text-slate-500 dark:text-slate-400">
									<ArrowDownCircleIcon className="mr-1 size-3 text-violet-500" />
									下载
								</span>
								<span className="text-[11px] font-black tracking-tight text-violet-700 dark:text-violet-300 sm:text-xs">
									{formatMbps(bytesPerSecondToMbps(downSpeed))}
								</span>
							</p>
						</section>
						<p className="flex flex-wrap gap-x-2 text-[9px] font-medium text-slate-500 dark:text-slate-400 sm:text-[10px]">
							<span>累计上传 {formatBytes(up)}</span>
							<span>累计下载 {formatBytes(down)}</span>
						</p>
					</section>
					{!disableAnimatedMan && (
						<img
							className="pointer-events-none absolute -bottom-4 right-2 z-0 w-20 opacity-[0.06] grayscale transition-all duration-300 group-hover:scale-105 group-hover:opacity-10"
							alt={"animated-man"}
							src={customIllustration}
							loading="eager"
						/>
					)}
				</CardContent>
			</Card>
		</section>
	);
}
