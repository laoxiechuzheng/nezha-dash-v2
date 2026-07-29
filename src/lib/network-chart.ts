import type { MonitorPeriod } from "@/lib/nezha-api";
import type { MonitorChartPoint } from "@/types/nezha-api";

export interface OutageInterval {
	start: number;
	end: number | null;
	errorCode: number;
	recovered: boolean;
}

export const periodDurationMs = (period: MonitorPeriod) => {
	switch (period) {
		case "6h":
			return 6 * 60 * 60 * 1000;
		case "7d":
			return 7 * 24 * 60 * 60 * 1000;
		case "30d":
			return 30 * 24 * 60 * 60 * 1000;
		default:
			return 24 * 60 * 60 * 1000;
	}
};

export const buildTimeDomain = (period: MonitorPeriod, end: number) =>
	[end - periodDurationMs(period), end] as const;

export const buildTimeTicks = (
	period: MonitorPeriod,
	end: number,
	count = 5,
) => {
	const [start] = buildTimeDomain(period, end);
	return Array.from({ length: count }, (_, index) =>
		Math.round(start + ((end - start) * index) / (count - 1)),
	);
};

export const compactMonitorPoints = (
	points: MonitorChartPoint[],
	maxPoints = 720,
) => {
	if (points.length <= maxPoints) return points;

	const mandatory = new Set<number>([0, points.length - 1]);
	for (let index = 1; index < points.length; index++) {
		if ((points[index].status ?? 1) !== (points[index - 1].status ?? 1)) {
			mandatory.add(index - 1);
			mandatory.add(index);
		}
	}

	const remaining = Math.max(0, maxPoints - mandatory.size);
	if (remaining > 0) {
		const bucketSize = points.length / remaining;
		for (let bucket = 0; bucket < remaining; bucket++) {
			const from = Math.floor(bucket * bucketSize);
			const to = Math.min(points.length, Math.ceil((bucket + 1) * bucketSize));
			let representative = from;
			for (let index = from + 1; index < to; index++) {
				const candidate = points[index].avg_delay ?? -1;
				const current = points[representative].avg_delay ?? -1;
				if (candidate > current) representative = index;
			}
			mandatory.add(representative);
		}
	}

	return [...mandatory].sort((a, b) => a - b).map((index) => points[index]);
};

export const buildOutageIntervals = (points: MonitorChartPoint[]) => {
	const intervals: OutageInterval[] = [];
	let current: OutageInterval | null = null;

	for (const point of points) {
		const failed = (point.status ?? 1) === 0;
		if (failed && !current) {
			current = {
				start: point.created_at,
				end: null,
				errorCode: point.error_code ?? 6,
				recovered: false,
			};
		} else if (failed && current && point.error_code) {
			current.errorCode = point.error_code;
		} else if (!failed && current) {
			current.end = point.created_at;
			current.recovered = true;
			intervals.push(current);
			current = null;
		}
	}

	if (current) intervals.push(current);
	return intervals;
};

export const formatDuration = (durationMs: number) => {
	const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
	if (totalSeconds < 60) return `${totalSeconds} 秒`;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes < 60)
		return seconds ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分钟`;
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return remainingMinutes
		? `${hours} 小时 ${remainingMinutes} 分`
		: `${hours} 小时`;
};
