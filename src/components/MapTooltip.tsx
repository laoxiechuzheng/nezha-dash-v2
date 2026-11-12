import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import useTooltip from "@/hooks/use-tooltip";
import { saveMainPageScrollPosition } from "@/lib/navigation";

const MapTooltip = memo(function MapTooltip() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { tooltipData } = useTooltip();

	if (!tooltipData) return null;

	const verticalPlacement =
		tooltipData.centroid[1] < 120
			? "translate(20%, 8px)"
			: tooltipData.centroid[1] > 380
				? "translate(20%, calc(-100% - 8px))"
				: "translate(20%, -50%)";

	return (
		<div
			className="tooltip-animate absolute z-50 hidden min-w-40 rounded-lg border border-border bg-popover px-3 py-2.5 text-[13px] text-popover-foreground shadow-popover lg:block"
			data-testid="map-tooltip"
			key={tooltipData.country}
			style={{
				left: tooltipData.centroid[0],
				top: tooltipData.centroid[1],
				transform: verticalPlacement,
			}}
			onMouseEnter={(e) => {
				e.stopPropagation();
			}}
		>
			<div>
				<p className="font-medium">
					{tooltipData.country === "China"
						? "Mainland China"
						: tooltipData.country}
				</p>
				<p className="mb-1.5 text-xs text-muted-foreground tabular-nums">
					{tooltipData.count} {t("map.Servers")}
				</p>
			</div>
			<div
				className="border-t border-border pt-1.5"
				style={{
					maxHeight: "200px",
					overflowY: "auto",
				}}
			>
				{tooltipData.servers.map((server) => (
					<button
						key={server.id}
						type="button"
						className="flex w-full items-center gap-2 rounded-[4px] px-1 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						onClick={() => {
							saveMainPageScrollPosition();
							navigate(`/server/${server.id}`);
						}}
					>
						<span
							className="status-dot"
							data-status={server.status ? "online" : "offline"}
						/>
						<span className="text-xs">{server.name}</span>
					</button>
				))}
			</div>
		</div>
	);
});

export default MapTooltip;
