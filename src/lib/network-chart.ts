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

export type TimeDomain = readonly [number, number];

export interface DelayChartScale {
	maximum: number;
	hasClippedPeaks: boolean;
}

export const zoomTimeDomain = (
	domain: TimeDomain,
	fullDomain: TimeDomain,
	factor: number,
	anchor = (domain[0] + domain[1]) / 2,
	minimumSpan = 60 * 1000,
): TimeDomain => {
	const fullSpan = Math.max(1, fullDomain[1] - fullDomain[0]);
	const currentSpan = Math.max(1, domain[1] - domain[0]);
	const nextSpan = Math.min(
		fullSpan,
		Math.max(minimumSpan, currentSpan * factor),
	);
	const anchorRatio = Math.min(
		1,
		Math.max(0, (anchor - domain[0]) / currentSpan),
	);
	let start = anchor - nextSpan * anchorRatio;
	let end = start + nextSpan;
	if (start < fullDomain[0]) {
		start = fullDomain[0];
		end = start + nextSpan;
	}
	if (end > fullDomain[1]) {
		end = fullDomain[1];
		start = end - nextSpan;
	}
	return [Math.round(start), Math.round(end)];
};

export const buildAdaptiveTimeTicks = (domain: TimeDomain, count = 6) => {
	const safeCount = Math.max(2, count);
	return Array.from({ length: safeCount }, (_, index) =>
		Math.round(domain[0] + ((domain[1] - domain[0]) * index) / (safeCount - 1)),
	);
};

export const formatAdaptiveTimeTick = (value: number, span: number) => {
	const date = new Date(value);
	const pad = (part: number) => part.toString().padStart(2, "0");
	if (span <= 2 * 60 * 60 * 1000) {
		return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
	}
	if (span <= 36 * 60 * 60 * 1000) {
		return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
	}
	return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
			const healthyIndices = Array.from(
				{ length: Math.max(0, to - from) },
				(_, offset) => from + offset,
			).filter(
				(index) =>
					(points[index].status ?? 1) !== 0 &&
					points[index].avg_delay !== null &&
					points[index].avg_delay !== undefined,
			);
			healthyIndices.sort(
				(a, b) => Number(points[a].avg_delay) - Number(points[b].avg_delay),
			);
			const representative = healthyIndices.length
				? healthyIndices[Math.floor((healthyIndices.length - 1) / 2)]
				: Math.min(points.length - 1, Math.floor((from + to - 1) / 2));
			mandatory.add(representative);
		}
	}

	return [...mandatory].sort((a, b) => a - b).map((index) => points[index]);
};

export const buildDelayChartScale = (
	points: MonitorChartPoint[],
): DelayChartScale => {
	const delays = points
		.filter(
			(point) =>
				(point.status ?? 1) !== 0 &&
				point.avg_delay !== null &&
				point.avg_delay !== undefined &&
				point.avg_delay > 0,
		)
		.map((point) => Number(point.avg_delay))
		.sort((a, b) => a - b);
	if (delays.length === 0) return { maximum: 100, hasClippedPeaks: false };

	const rawMaximum = delays[delays.length - 1];
	const p95 = delays[Math.floor((delays.length - 1) * 0.95)];
	const hasClippedPeaks = rawMaximum > Math.max(250, p95 * 1.5);
	const maximum = hasClippedPeaks
		? Math.max(100, Math.ceil((p95 * 1.25) / 10) * 10)
		: Math.max(100, Math.ceil((rawMaximum * 1.1) / 10) * 10);
	return { maximum, hasClippedPeaks };
};

export const selectAnomalyMonitorPoints = (
	points: MonitorChartPoint[],
	maximum: number,
	maxPoints = 96,
) => {
	const anomalies = points.filter(
		(point) =>
			(point.status ?? 1) !== 0 &&
			point.avg_delay !== null &&
			point.avg_delay !== undefined &&
			point.avg_delay > maximum,
	);
	if (anomalies.length <= maxPoints) return anomalies;
	return Array.from(
		{ length: maxPoints },
		(_, index) =>
			anomalies[
				Math.min(
					anomalies.length - 1,
					Math.floor((index * anomalies.length) / maxPoints),
				)
			],
	);
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
