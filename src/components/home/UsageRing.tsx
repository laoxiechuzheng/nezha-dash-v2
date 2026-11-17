import { Cpu, HardDrive, MemoryStick } from "lucide-react";
import { getUsageLevel } from "@/components/ServerUsageBar";

export type UsageMetric = "cpu" | "memory" | "disk";
const metricIcons = { cpu: Cpu, memory: MemoryStick, disk: HardDrive };

export default function UsageRing({
	value,
	metric,
}: {
	value: number;
	metric: UsageMetric;
}) {
	const known = Number.isFinite(value);
	const quantized = known
		? Math.round(Math.max(0, Math.min(100, value)) * 2) / 2
		: 0;
	const Icon = metricIcons[metric];
	return (
		<svg
			className="hm-usage-ring"
			width="40"
			height="40"
			viewBox="0 0 40 40"
			aria-hidden="true"
			focusable="false"
			data-unknown={!known || undefined}
		>
			<circle
				className="hm-ring-track"
				cx="20"
				cy="20"
				r="18"
				fill="none"
				strokeWidth="4"
			/>
			{known && (
				<circle
					className="hm-ring-value"
					cx="20"
					cy="20"
					r="18"
					fill="none"
					strokeWidth="4"
					pathLength="100"
					strokeDasharray="100"
					strokeDashoffset={100 - quantized}
					stroke={`url(#lumen-${getUsageLevel(value)})`}
					transform="rotate(-90 20 20)"
				/>
			)}
			<Icon
				x="13"
				y="13"
				width="14"
				height="14"
				className="text-muted-foreground"
			/>
		</svg>
	);
}
