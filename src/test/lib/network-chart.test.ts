import { describe, expect, it } from "vitest";
import {
	buildAdaptiveTimeTicks,
	buildOutageIntervals,
	buildTimeDomain,
	buildTimeTicks,
	compactMonitorPoints,
	formatAdaptiveTimeTick,
	formatDuration,
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
