import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/20/solid";
import { type MouseEvent, memo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useHomeDisplay } from "@/components/home/HomeDisplay";
import Sparkline from "@/components/home/Sparkline";
import ServerFlag from "@/components/ServerFlag";
import ServerPlatform from "@/components/ServerPlatform";
import UsageCell from "@/components/UsageCell";
import { formatBytes } from "@/lib/format";
import { saveMainPageScrollPosition } from "@/lib/navigation";
import { cn, formatMbps, formatNezhaInfo, parsePublicNote } from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";
import BillingInfo from "./billingInfo";
import PlanInfo from "./PlanInfo";

function ServerCard({
	now,
	serverInfo,
}: {
	now: number;
	serverInfo: NezhaServer;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { highDensity, traces } = useHomeDisplay();
	const info = formatNezhaInfo(now, serverInfo);
	const {
		name,
		country_code,
		online,
		up,
		down,
		net_in_transfer,
		net_out_transfer,
		public_note,
		platform,
		uptime,
		last_active_time_string,
	} = info;
	// formatNezhaInfo 的旧零值回退只供排序/已有调用方；仪表明确保留未知值。
	const cpu = Number.isFinite(serverInfo.state?.cpu)
		? serverInfo.state.cpu
		: Number.NaN;
	const mem =
		Number.isFinite(serverInfo.state?.mem_used) &&
		serverInfo.host?.mem_total > 0
			? (serverInfo.state.mem_used / serverInfo.host.mem_total) * 100
			: Number.NaN;
	const stg =
		Number.isFinite(serverInfo.state?.disk_used) &&
		serverInfo.host?.disk_total > 0
			? (serverInfo.state.disk_used / serverInfo.host.disk_total) * 100
			: Number.NaN;
	const parsedData = parsePublicNote(public_note);
	const href = `/server/${serverInfo.id}`;
	const cardClick = (event: MouseEvent<HTMLAnchorElement>) => {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.button)
			return;
		event.preventDefault();
		saveMainPageScrollPosition();
		navigate(href);
	};
	const uptimeLabel =
		uptime / 86400 >= 1
			? `${(uptime / 86400).toFixed(0)} ${t("serverCard.days")}`
			: `${(uptime / 3600).toFixed(0)} ${t("serverCard.hours")}`;
	return (
		<a
			href={href}
			onClick={cardClick}
			data-online={online}
			className={cn(
				"hm-node-tile surface-raised spot",
				!online && "hm-node-offline",
				window.CustomBackgroundImage && "bg-card/80",
			)}
		>
			<section className="hm-node-title">
				<span
					role="img"
					className="status-dot hm-node-status"
					data-status={online ? "online" : "offline"}
					aria-label={t(online ? "filter.online" : "serverList.offline")}
				/>
				<ServerFlag country_code={country_code} className="hm-node-flag" />
				<p title={name}>{name}</p>
				<span className="chip num" data-tone={online ? "neutral" : "danger"}>
					{online ? uptimeLabel : t("serverList.offline")}
				</span>
			</section>
			<div className="hm-node-subline">
				<ServerPlatform platform={platform} />
				{parsedData?.billingDataMod && (
					<div className="hm-node-billing">
						<BillingInfo parsedData={parsedData} />
					</div>
				)}
			</div>
			{parsedData?.planDataMod && <PlanInfo parsedData={parsedData} />}
			{online ? (
				<>
					<section
						data-testid="server-card-resource-metrics"
						className={cn(
							"hm-node-resources",
							highDensity && "hm-node-resources-high",
						)}
					>
						<UsageCell
							label="CPU"
							metric="cpu"
							value={cpu}
							variant={highDensity ? "bar" : "ring"}
						/>
						<UsageCell
							label={t("serverCard.mem")}
							metric="memory"
							value={mem}
							variant={highDensity ? "bar" : "ring"}
						/>
						<UsageCell
							label={t("serverCard.stg")}
							metric="disk"
							value={stg}
							variant={highDensity ? "bar" : "ring"}
						/>
					</section>
					<section
						data-testid="server-card-network-metrics"
						className="hm-node-bottom"
					>
						<div className="hm-node-rates">
							<fieldset aria-label={t("serverCard.download")} className="num">
								<ArrowDownIcon
									className="size-3 text-chart-2"
									aria-hidden="true"
								/>
								<span className="sr-only">实时下载</span>
								<span>{formatMbps(down)}</span>
							</fieldset>
							<fieldset aria-label={t("serverCard.upload")} className="num">
								<ArrowUpIcon
									className="size-3 text-chart-1"
									aria-hidden="true"
								/>
								<span className="sr-only">实时上传</span>
								<span>{formatMbps(up)}</span>
							</fieldset>
						</div>
						{!highDensity && traces.has(serverInfo.id) && (
							<Sparkline samples={traces.get(serverInfo.id) ?? []} />
						)}
						<div className="hm-node-transfers num">
							<span>
								<ArrowDownIcon className="size-3" aria-hidden="true" />
								<span className="sr-only">已用 </span>
								{formatBytes(net_in_transfer)}
							</span>
							<span>
								<ArrowUpIcon className="size-3" aria-hidden="true" />
								<span className="sr-only">已用 </span>
								{formatBytes(net_out_transfer)}
							</span>
						</div>
					</section>
				</>
			) : (
				<p className="hm-last-seen num">
					{t("v2Home.fleet.lastSeen", { time: last_active_time_string || "—" })}
				</p>
			)}
		</a>
	);
}

export default memo(ServerCard);
