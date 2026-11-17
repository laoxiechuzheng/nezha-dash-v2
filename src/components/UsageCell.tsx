import UsageRing, { type UsageMetric } from "@/components/home/UsageRing";
import ServerUsageBar, { getUsageLevel } from "@/components/ServerUsageBar";
import { cn } from "@/lib/utils";

/** Label + tabular percentage above a threshold-colored usage bar. */
export default function UsageCell({
	label,
	value,
	className,
	labelClassName,
	valueRowClassName,
	variant = "bar",
	metric = "cpu",
}: {
	label: string;
	value: number;
	className?: string;
	labelClassName?: string;
	valueRowClassName?: string;
	variant?: "bar" | "ring";
	metric?: UsageMetric;
}) {
	const level = getUsageLevel(value);
	const known = Number.isFinite(value);
	const reading = known ? `${value.toFixed(2)}%` : "—";

	if (variant === "ring") {
		return (
			<div className={cn("hm-usage-cell", className)}>
				<UsageRing value={value} metric={metric} />
				<span
					data-level={level}
					className={cn(
						"num whitespace-nowrap text-[13px] font-semibold",
						level === "warn" && "text-warning",
						level === "bad" && "text-danger",
					)}
				>
					{reading}
				</span>
				<span className="hm-usage-label">{label}</span>
				<ServerUsageBar value={value} className="sr-only" />
			</div>
		);
	}

	return (
		<div className={cn("min-w-0", className)}>
			<div
				className={cn(
					"flex items-baseline justify-between gap-1.5",
					valueRowClassName,
				)}
			>
				<span
					className={cn(
						"truncate text-xs text-muted-foreground",
						labelClassName,
					)}
				>
					{label}
				</span>
				<span
					data-level={level}
					className={cn(
						"whitespace-nowrap text-[13px] font-medium tabular-nums",
						level === "warn" && "text-warning",
						level === "bad" && "text-danger",
					)}
				>
					{reading}
				</span>
			</div>
			<ServerUsageBar value={value} className="mt-1.5 h-[5px]" />
		</div>
	);
}
