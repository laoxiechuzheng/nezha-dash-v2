import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type UsageLevel = "good" | "warn" | "bad";

/** Resource usage thresholds: above 70% warns, above 90% is critical. */
export function getUsageLevel(value: number): UsageLevel {
	if (value > 90) return "bad";
	if (value > 70) return "warn";
	return "good";
}

const indicatorByLevel: Record<UsageLevel, string> = {
	good: "bg-primary",
	warn: "bg-warning",
	bad: "bg-danger",
};

type ServerUsageBarProps = {
	value: number;
	className?: string;
};

export default function ServerUsageBar({
	value,
	className,
}: ServerUsageBarProps) {
	const level = getUsageLevel(value);

	return (
		<Progress
			aria-label={"Server Usage Bar"}
			aria-labelledby={"Server Usage Bar"}
			value={value}
			data-level={level}
			indicatorClassName={indicatorByLevel[level]}
			className={cn("mt-1 h-1", className)}
		/>
	);
}
