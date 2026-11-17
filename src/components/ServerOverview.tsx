import { useTranslation } from "react-i18next";
import FleetRing from "@/components/home/FleetRing";
import FleetStage from "@/components/home/FleetStage";
import TopTalkers from "@/components/home/TopTalkers";
import NumericText from "@/components/NumericText";
import { useFleetTrace } from "@/hooks/use-fleet-trace";
import { useStatus } from "@/hooks/use-status";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { isFleetOnline } from "@/lib/fleet-trace";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";

type ServerOverviewProps = {
	online: number;
	offline: number;
	total: number;
	up: number;
	down: number;
	upSpeed: number;
	downSpeed: number;
	groupServerIds?: number[];
	servers?: NezhaServer[];
	now?: number;
};

export default function ServerOverview({
	online,
	offline,
	total,
	up,
	down,
	upSpeed,
	downSpeed,
	groupServerIds,
	servers,
	now,
}: ServerOverviewProps) {
	const { t } = useTranslation();
	const { status, setStatus } = useStatus();
	const { messageHistory, connected } = useWebSocketContext();
	const samples = useFleetTrace(messageHistory, "fleet", groupServerIds);
	const hasTalkers =
		now !== undefined &&
		(servers?.filter(
			(server) =>
				isFleetOnline(now, server) &&
				(server.state?.net_in_speed || 0) + (server.state?.net_out_speed || 0) >
					0,
		).length ?? 0) >= 2;
	return (
		<section
			aria-label={t("overview")}
			className={cn(
				"server-overview hm-hero",
				window.CustomBackgroundImage && "opacity-95",
			)}
		>
			<FleetStage
				samples={samples}
				connected={connected}
				up={up}
				down={down}
				upSpeed={upSpeed}
				downSpeed={downSpeed}
			/>
			<div
				className={cn(
					"surface hm-fleet",
					hasTalkers && "hm-fleet-with-talkers",
				)}
			>
				<div className="hm-fleet-summary">
					<FleetRing online={online} total={total} label={t("filter.online")} />
					<div className="hm-fleet-bar" aria-hidden="true">
						{online > 0 && (
							<span style={{ flex: online }} data-status="online" />
						)}
						{offline > 0 && (
							<span style={{ flex: offline }} data-status="offline" />
						)}
					</div>
					<div className="hm-fleet-filters">
						{(
							[
								{
									filter: "all",
									label: "serverOverview.totalServers",
									value: total,
								},
								{
									filter: "online",
									label: "serverOverview.onlineServers",
									value: online,
								},
								{
									filter: "offline",
									label: "serverOverview.offlineServers",
									value: offline,
								},
							] as const
						).map(({ filter, label, value }) => (
							<button
								key={filter}
								type="button"
								data-filter={filter}
								aria-pressed={status === filter}
								className="hm-fleet-filter"
								onClick={() => setStatus(filter)}
							>
								<span
									className={cn(
										"status-dot",
										filter === "online" && "hm-fleet-ping",
									)}
									data-status={filter === "all" ? "unknown" : filter}
									aria-hidden="true"
								/>
								<span title={t(label)}>{t(label)}</span>
								<NumericText
									value={value}
									className={cn(
										"num",
										filter === "offline" && value > 0 && "text-danger",
									)}
								/>
							</button>
						))}
						<div className="hm-fleet-traffic">
							<span>{t("v2Home.fleet.totalTransfer")}</span>
							<strong className="num">{formatBytes(up + down)}</strong>
						</div>
					</div>
				</div>
				{servers && now !== undefined && (
					<TopTalkers servers={servers} now={now} />
				)}
			</div>
		</section>
	);
}
