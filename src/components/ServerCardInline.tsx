import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/20/solid";
import type { MouseEvent } from "react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import ServerFlag from "@/components/ServerFlag";
import ServerPlatform from "@/components/ServerPlatform";
import UsageCell from "@/components/UsageCell";
import { formatBytes } from "@/lib/format";
import { saveMainPageScrollPosition } from "@/lib/navigation";
import { cn, formatMbps, formatNezhaInfo, parsePublicNote } from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";
import BillingInfo from "./billingInfo";
import PlanInfo from "./PlanInfo";
import { Badge } from "./ui/badge";

/**
 * One server in the list view (the default home view). The same DOM renders
 * as a table row from md up and as a compact card on phones; see
 * `.server-row` in index.css for the grid areas.
 */
function ServerCardInline({
	now,
	serverInfo,
}: {
	now: number;
	serverInfo: NezhaServer;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const {
		name,
		country_code,
		online,
		cpu,
		up,
		down,
		mem,
		stg,
		platform,
		uptime,
		load_1,
		net_in_transfer,
		net_out_transfer,
		public_note,
		last_active_time_string,
	} = formatNezhaInfo(now, serverInfo);

	const href = `/server/${serverInfo.id}`;
	const rowClick = (event: MouseEvent<HTMLAnchorElement>) => {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.button) {
			return;
		}
		event.preventDefault();
		saveMainPageScrollPosition();
		navigate(href);
	};

	const parsedData = parsePublicNote(public_note);
	const hasBilling = Boolean(parsedData?.billingDataMod);
	const hasPlan = Boolean(parsedData?.planDataMod);

	const nameCell = (
		<div className="flex min-w-0 flex-col gap-1 [grid-area:name]">
			<div className="flex min-w-0 items-center gap-2">
				<span
					className="status-dot"
					data-status={online ? "online" : "offline"}
				/>
				<ServerFlag
					country_code={country_code}
					className="shrink-0 leading-none"
				/>
				<span
					className={cn(
						"truncate text-[13px] font-medium",
						!online && "text-muted-foreground",
					)}
				>
					{name}
				</span>
			</div>
			{(online || hasBilling) && (
				<div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 pl-4 text-[11px] text-muted-foreground [&_p]:text-[11px] [&>div]:text-[11px]">
					{online && (
						<span className="flex min-w-0 items-center">
							<span className="sr-only">{t("serverCard.system")}</span>
							<ServerPlatform platform={platform} />
						</span>
					)}
					{hasBilling && parsedData && <BillingInfo parsedData={parsedData} />}
				</div>
			)}
			{hasPlan && parsedData && (
				<div className="pl-4">
					<PlanInfo parsedData={parsedData} />
				</div>
			)}
		</div>
	);

	if (!online) {
		return (
			<a
				href={href}
				onClick={rowClick}
				data-online="false"
				className="server-row group px-4 py-3 text-muted-foreground transition-colors duration-150 hover:bg-muted/60 dark:hover:bg-foreground/[0.03]"
			>
				{nameCell}
				<div className="flex min-w-0 flex-wrap items-center gap-2 pl-4 text-xs [grid-area:info] md:pl-0">
					<Badge variant="destructive">{t("serverList.offline")}</Badge>
					{last_active_time_string && (
						<span className="truncate">
							{t("serverDetail.lastActive")}{" "}
							<span className="font-mono tabular-nums">
								{last_active_time_string}
							</span>
						</span>
					)}
				</div>
			</a>
		);
	}

	const uptimeLabel =
		uptime / 86400 >= 1
			? `${(uptime / 86400).toFixed(0)} ${t("serverCard.days")}`
			: `${(uptime / 3600).toFixed(0)} ${t("serverCard.hours")}`;

	return (
		<a
			href={href}
			onClick={rowClick}
			data-online="true"
			className="server-row group px-4 py-3 transition-colors duration-150 hover:bg-muted/60 md:py-2.5 dark:hover:bg-foreground/[0.03]"
		>
			{nameCell}
			<UsageCell
				label="CPU"
				value={cpu}
				className="[grid-area:cpu]"
				labelClassName="md:hidden"
				valueRowClassName="md:justify-end"
			/>
			<UsageCell
				label={t("serverCard.mem")}
				value={mem}
				className="[grid-area:mem]"
				labelClassName="md:hidden"
				valueRowClassName="md:justify-end"
			/>
			<UsageCell
				label={t("serverCard.stg")}
				value={stg}
				className="[grid-area:disk]"
				labelClassName="md:hidden"
				valueRowClassName="md:justify-end"
			/>
			<div className="flex min-w-0 items-center gap-3 text-xs tabular-nums [grid-area:speed] md:flex-col md:items-end md:gap-0.5">
				<span className="flex items-center gap-1 whitespace-nowrap">
					<ArrowUpIcon aria-hidden="true" className="size-3 text-chart-1" />
					<span className="sr-only">{t("serverCard.upload")}</span>
					<span className="font-medium">{formatMbps(up)}</span>
				</span>
				<span className="flex items-center gap-1 whitespace-nowrap">
					<ArrowDownIcon aria-hidden="true" className="size-3 text-chart-2" />
					<span className="sr-only">{t("serverCard.download")}</span>
					<span className="font-medium">{formatMbps(down)}</span>
				</span>
			</div>
			<div className="flex min-w-0 flex-col items-end gap-0.5 text-xs text-muted-foreground tabular-nums [grid-area:traffic]">
				<span className="flex items-center gap-1 whitespace-nowrap">
					<ArrowUpIcon aria-hidden="true" className="size-3" />
					<span className="sr-only">{t("serverCard.totalUpload")}</span>
					<span>{formatBytes(net_out_transfer)}</span>
				</span>
				<span className="flex items-center gap-1 whitespace-nowrap">
					<ArrowDownIcon aria-hidden="true" className="size-3" />
					<span className="sr-only">{t("serverCard.totalDownload")}</span>
					<span>{formatBytes(net_in_transfer)}</span>
				</span>
			</div>
			<span className="hidden text-right text-xs tabular-nums [grid-area:load] xl:block">
				{load_1}
			</span>
			<span className="self-start text-right text-xs text-muted-foreground tabular-nums [grid-area:uptime] md:hidden xl:block xl:self-center xl:text-foreground">
				<span className="sr-only">{t("serverCard.uptime")} </span>
				{uptimeLabel}
			</span>
		</a>
	);
}

export default memo(ServerCardInline);
