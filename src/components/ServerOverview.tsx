import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/20/solid";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
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

type StatusFilter = "all" | "online" | "offline";

function KpiLabel({ children }: { children: ReactNode }) {
	return (
		<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
			{children}
		</span>
	);
}

/** A clickable KPI block that doubles as the status filter. */
function StatusKpi({
	filter,
	label,
	value,
	active,
	tone,
	onSelect,
}: {
	filter: StatusFilter;
	label: string;
	value: number;
	active: boolean;
	tone?: "online" | "offline";
	onSelect: (filter: StatusFilter) => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			data-filter={filter}
			onClick={() => onSelect(filter)}
			className={cn(
				"group relative flex min-w-0 flex-col items-start gap-1.5 bg-card px-4 py-3.5 text-left transition-colors duration-150 hover:bg-muted/60 sm:px-5 dark:hover:bg-foreground/[0.03]",
				active && "shadow-[inset_0_-2px_0_hsl(var(--primary))]",
			)}
		>
			<KpiLabel>
				{tone && <span className="status-dot" data-status={tone} />}
				{label}
			</KpiLabel>
			<NumericText
				value={value}
				className={cn(
					"text-2xl font-semibold leading-none tabular-nums sm:text-[28px]",
					tone === "offline" && value > 0 && "text-danger",
				)}
			/>
		</button>
	);
}

function RateKpi({
	label,
	value,
	icon,
}: {
	label: string;
	value: string;
	icon: ReactNode;
}) {
	return (
		<div className="flex min-w-0 flex-col items-start gap-1.5 bg-card px-4 py-3.5 sm:px-5">
			<KpiLabel>
				{icon}
				{label}
			</KpiLabel>
			<span className="truncate text-xl font-semibold leading-none tabular-nums sm:text-2xl">
				{value}
			</span>
		</div>
	);
}

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

	// Only an explicitly configured illustration is shown; the default
	// decorative figure does not fit the quiet Signal surface.
	// @ts-expect-error CustomIllustration is a global variable
	const customIllustration = window.CustomIllustration as string | undefined;

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	return (
		<section
			aria-label={t("overview")}
			className={cn(
				"server-overview grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-6",
				{
					"opacity-95": customBackgroundImage,
				},
			)}
		>
			<StatusKpi
				filter="all"
				label={t("serverOverview.totalServers")}
				value={total}
				active={status === "all"}
				onSelect={setStatus}
			/>
			<StatusKpi
				filter="online"
				label={t("serverOverview.onlineServers")}
				value={online}
				active={status === "online"}
				tone="online"
				onSelect={setStatus}
			/>
			<StatusKpi
				filter="offline"
				label={t("serverOverview.offlineServers")}
				value={offline}
				active={status === "offline"}
				tone="offline"
				onSelect={setStatus}
			/>
			<RateKpi
				label={t("serverOverview.uploadSpeed")}
				value={formatMbps(bytesPerSecondToMbps(upSpeed))}
				icon={<ArrowUpIcon className="size-3.5 text-chart-1" />}
			/>
			<RateKpi
				label={t("serverOverview.downloadSpeed")}
				value={formatMbps(bytesPerSecondToMbps(downSpeed))}
				icon={<ArrowDownIcon className="size-3.5 text-chart-2" />}
			/>
			<div className="relative flex min-w-0 flex-col items-start justify-center gap-1.5 overflow-hidden bg-card px-4 py-3.5 sm:px-5">
				<KpiLabel>{t("serverOverview.totalTraffic")}</KpiLabel>
				<div className="flex w-full flex-col gap-0.5 text-[13px] tabular-nums">
					<span className="flex items-center gap-1.5">
						<ArrowUpIcon className="size-3.5 text-muted-foreground" />
						<span className="font-medium">{formatBytes(up)}</span>
					</span>
					<span className="flex items-center gap-1.5">
						<ArrowDownIcon className="size-3.5 text-muted-foreground" />
						<span className="font-medium">{formatBytes(down)}</span>
					</span>
				</div>
				{customIllustration && !disableAnimatedMan && (
					<img
						className="pointer-events-none absolute -bottom-3 right-2 w-14 opacity-10 grayscale"
						alt={"animated-man"}
						src={customIllustration}
						loading="eager"
					/>
				)}
			</div>
		</section>
	);
}
