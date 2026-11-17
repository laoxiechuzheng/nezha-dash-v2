import { type RefObject, useLayoutEffect, useRef } from "react";
import type { FleetSample } from "@/lib/fleet-trace";
import { bytesPerSecondToMbps, formatMbps } from "@/lib/utils";

/** 用实际绘图区与已排版的浮层宽度夹紧，而不是只夹样本锚点。 */
export default function TraceTooltip({
	drawingRef,
	sample,
	fraction,
}: {
	drawingRef: RefObject<HTMLDivElement | null>;
	sample: FleetSample;
	fraction: number;
}) {
	const tooltipRef = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const drawing = drawingRef.current;
		const tooltip = tooltipRef.current;
		if (!drawing || !tooltip) return;
		const place = () => {
			const width = drawing.getBoundingClientRect().width;
			tooltip.style.maxWidth = `${Math.max(0, width)}px`;
			const tooltipWidth = tooltip.getBoundingClientRect().width;
			const anchor = Math.max(0, Math.min(1, fraction)) * width;
			tooltip.style.left = `${Math.max(0, Math.min(anchor - tooltipWidth / 2, width - tooltipWidth))}px`;
		};
		place();
		const observer = new ResizeObserver(place);
		observer.observe(drawing);
		observer.observe(tooltip);
		return () => observer.disconnect();
	}, [drawingRef, fraction]);
	return (
		<div ref={tooltipRef} className="hm-trace-tooltip num" role="tooltip">
			<time>
				{new Date(sample.t).toLocaleTimeString([], { hour12: false })}
			</time>
			<span>↓ {formatMbps(bytesPerSecondToMbps(sample.down))}</span>
			<span>↑ {formatMbps(bytesPerSecondToMbps(sample.up))}</span>
		</div>
	);
}
