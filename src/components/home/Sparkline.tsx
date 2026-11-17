import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { type NodeSample, tracePaths, traceTiming } from "@/lib/fleet-trace";

export default function Sparkline({ samples }: { samples: NodeSample[] }) {
	const { t } = useTranslation();
	const geometry = useMemo(() => {
		const valid = samples.filter((sample) => sample.value !== null);
		if (valid.length < 5) return null;
		const timing = traceTiming(samples);
		return {
			...tracePaths(
				samples,
				[samples[0].t, samples[samples.length - 1].t],
				Math.max(1, ...valid.map((p) => p.value ?? 0)),
				72,
				28,
				timing.gap,
			),
			span: timing.span,
			count: valid.length,
		};
	}, [samples]);
	if (!geometry) return null;
	const span =
		geometry.span < 90_000
			? t("v2Home.trace.spanSeconds", { n: Math.round(geometry.span / 1000) })
			: t("v2Home.trace.spanMinutes", {
					n: (geometry.span / 60_000).toFixed(1),
				});
	const label = t("v2Home.trace.tileTitle", { span, count: geometry.count });
	return (
		<svg
			className="hm-sparkline"
			viewBox="0 0 72 28"
			preserveAspectRatio="none"
			role="img"
			aria-label={label}
		>
			<title>{label}</title>
			<path d={geometry.area} fill="url(#lumen-area-spark)" />
			<path
				d={geometry.line}
				fill="none"
				stroke="hsl(var(--chart-1))"
				strokeWidth="1.5"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
