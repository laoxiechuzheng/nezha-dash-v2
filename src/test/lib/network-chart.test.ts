import { describe, expect, it } from "vitest";
import {
	buildAdaptiveTimeTicks,
	buildDelayChartScale,
	buildOutageIntervals,
	buildTimeDomain,
	buildTimeTicks,
	compactMonitorPoints,
	formatAdaptiveTimeTick,
	formatDuration,
	selectAnomalyMonitorPoints,
	zoomTimeDomain,
} from "@/lib/network-chart";

describe("network chart time model", () => {
	it("always uses the full selected period", () => {
		const now = Date.parse("2026-07-29T00:00:00Z");
		expect(buildTimeDomain("6h", now)).toEqual([now - 6 * 60 * 60 * 1000, now]);
		expect(buildTimeDomain("1d", now)).toEqual([
			now - 24 * 60 * 60 * 1000,
			now,
		]);
		expect(buildTimeTicks("6h", now, 4)).toHaveLength(4);
	});

	it("zooms around an anchor, stays inside the period, and adapts ticks", () => {
		const full = [0, 6 * 60 * 60 * 1000] as const;
		const zoomed = zoomTimeDomain(full, full, 0.5, full[1]);
		expect(zoomed).toEqual([3 * 60 * 60 * 1000, full[1]]);
		expect(buildAdaptiveTimeTicks(zoomed, 5)).toHaveLength(5);
		expect(zoomTimeDomain(zoomed, full, 2)).toEqual(full);
		expect(
			formatAdaptiveTimeTick(Date.parse("2026-07-29T08:09:10"), 60 * 60 * 1000),
		).toContain("08:09:10");
	});

	it("keeps real samples and every outage transition while compacting", () => {
		const points = Array.from({ length: 5000 }, (_, index) => ({
			created_at: index * 5000,
			avg_delay: index % 100,
			status: index >= 2000 && index < 2100 ? 0 : 1,
		}));
		const compacted = compactMonitorPoints(points, 300);
		expect(compacted.length).toBeLessThanOrEqual(304);
		expect(compacted.some((point) => point.created_at === 1999 * 5000)).toBe(
			true,
		);
		expect(compacted.some((point) => point.created_at === 2000 * 5000)).toBe(
			true,
		);
		expect(compacted.some((point) => point.created_at === 2099 * 5000)).toBe(
			true,
		);
		expect(compacted.some((point) => point.created_at === 2100 * 5000)).toBe(
			true,
		);
	});

	it("represents dense healthy buckets without biasing every bucket to its peak", () => {
		const points = Array.from({ length: 4320 }, (_, index) => ({
			created_at: index * 5000,
			avg_delay: index % 24 === 0 ? 2200 : 50 + (index % 51),
			status: 1,
		}));

		const compacted = compactMonitorPoints(points, 360);
		const inputSamples = new Set(points.map((point) => point.created_at));
		const selectedPeaks = compacted.filter(
			(point) => point.avg_delay === 2200,
		).length;

		expect(compacted[0]).toBe(points[0]);
		expect(compacted[compacted.length - 1]).toBe(points[points.length - 1]);
		expect(compacted.every((point) => inputSamples.has(point.created_at))).toBe(
			true,
		);
		expect(
			compacted.every(
				(point, index) =>
					index === 0 || point.created_at > compacted[index - 1].created_at,
			),
		).toBe(true);
		expect(selectedPeaks).toBeLessThan(compacted.length * 0.1);
	});

	it("returns the original five-second samples when a zoomed range fits the limit", () => {
		const points = Array.from({ length: 121 }, (_, index) => ({
			created_at: index * 5000,
			avg_delay: 50 + (index % 20),
			status: 1,
		}));

		expect(compactMonitorPoints(points, 300)).toBe(points);
	});

	it("keeps normal latency readable and exposes clipped peaks as real samples", () => {
		const points = Array.from({ length: 1000 }, (_, index) => ({
			created_at: index * 5000,
			avg_delay: index % 25 === 0 ? 2200 : 50 + (index % 121),
			status: 1,
		}));
		const scale = buildDelayChartScale(points);
		const anomalies = selectAnomalyMonitorPoints(points, scale.maximum, 20);

		expect(scale.hasClippedPeaks).toBe(true);
		expect(scale.maximum).toBeGreaterThanOrEqual(170);
		expect(scale.maximum).toBeLessThan(500);
		expect(anomalies).toHaveLength(20);
		const inputSamples = new Set(points.map((point) => point.created_at));
		expect(anomalies.every((point) => inputSamples.has(point.created_at))).toBe(
			true,
		);
		expect(anomalies.every((point) => point.avg_delay === 2200)).toBe(true);
	});

	it("turns failures into readable outage intervals", () => {
		const intervals = buildOutageIntervals([
			{ created_at: 0, avg_delay: 10, status: 1 },
			{ created_at: 5000, avg_delay: null, status: 0, error_code: 1 },
			{ created_at: 10000, avg_delay: null, status: 0, error_code: 1 },
			{ created_at: 15000, avg_delay: 12, status: 1 },
		]);
		expect(intervals).toEqual([
			{ start: 5000, end: 15000, errorCode: 1, recovered: true },
		]);
		expect(formatDuration(10000)).toBe("10 秒");
	});
});
