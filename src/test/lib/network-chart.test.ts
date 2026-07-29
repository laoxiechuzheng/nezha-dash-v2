import { describe, expect, it } from "vitest";
import {
	buildOutageIntervals,
	buildTimeDomain,
	buildTimeTicks,
	compactMonitorPoints,
	formatDuration,
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
