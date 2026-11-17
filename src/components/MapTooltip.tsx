import { memo, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import useTooltip from "@/hooks/use-tooltip";
import { saveMainPageScrollPosition } from "@/lib/navigation";

const MapTooltip = memo(function MapTooltip() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { tooltipData } = useTooltip();

	const ref = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState({ left: 8, top: 8 });
	useLayoutEffect(() => {
		const tooltip = ref.current;
		const parent = tooltip?.parentElement;
		if (!tooltip || !parent || !tooltipData) return;
		const place = () => {
			const bounds = parent.getBoundingClientRect();
			const measured = tooltip.getBoundingClientRect();
			const width = measured.width || 220;
			const height = measured.height || 80;
			setPosition({
				left: Math.max(
					8,
					Math.min(tooltipData.centroid[0] + 12, bounds.width - width - 8),
				),
				top: Math.max(
					8,
					Math.min(
						tooltipData.centroid[1] - height / 2,
						bounds.height - height - 8,
					),
				),
			});
		};
		place();
		const observer = new ResizeObserver(place);
		observer.observe(parent);
		return () => observer.disconnect();
	}, [tooltipData]);
	if (!tooltipData) return null;

	return (
		<div
			ref={ref}
			className="hm-map-tooltip tooltip-animate absolute z-50 hidden min-w-40 rounded-lg border border-border bg-popover px-3 py-2.5 text-[13px] text-popover-foreground shadow-popover lg:block"
			data-testid="map-tooltip"
			key={tooltipData.country}
			style={position}
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
				{tooltipData.servers.slice(0, 5).map((server) => (
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
				{tooltipData.servers.length > 5 && (
					<span className="text-xs text-muted-foreground">
						{t("v2Home.attention.more", {
							count: tooltipData.servers.length - 5,
						})}
					</span>
				)}
			</div>
		</div>
	);
});

export default MapTooltip;
