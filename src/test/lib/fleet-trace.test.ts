import { describe, expect, it } from "vitest";
import {
	acceptTraceMessages,
	buildFleetTrace,
	buildNodeTraces,
	fleetMemberKey,
	tracePaths,
	traceTiming,
} from "@/lib/fleet-trace";
import { createServer } from "@/test/fixtures";
import type { NezhaWebsocketResponse } from "@/types/nezha-api";

const base = Date.parse("2025-01-01T00:00:00Z");
function message(offset: number, ids = [1, 2]): NezhaWebsocketResponse {
	const now = base + offset;
	return {
		now,
		servers: ids.map((id) =>
			createServer({
				id,
				last_active: new Date(now).toISOString(),
				state: { net_in_speed: id * 100, net_out_speed: id * 10 },
			}),
		),
	};
}
const history = (times: number[]) =>
	times.map((time) => message(time)).reverse();
describe("fleet trace bounded full replay", () => {
	it("keeps zero/one/four real samples without padding and uses the message clock", () => {
		expect(buildFleetTrace([])).toEqual([]);
		expect(buildFleetTrace([message(1234)], [2])).toEqual([
			{ t: base + 1234, down: 200, up: 20, count: 1 },
		]);
		const samples = buildFleetTrace(history([0, 1100, 4500, 5000]));
		expect(samples).toHaveLength(4);
		expect(traceTiming(samples)).toMatchObject({
			span: 5000,
			interval: 1100,
			count: 4,
		});
	});
	it("discards duplicate and out-of-order timestamps, not sorting them into reality", () => {
		expect(
			buildFleetTrace(history([0, 2000, 2000, 1000, 4000])).map(
				(p) => p.t - base,
			),
		).toEqual([0, 2000, 4000]);
	});
	it("starts a fresh epoch only on a rollback larger than sixty seconds", () => {
		expect(
			acceptTraceMessages(history([100000, 101000, 41000, 40000, 42000])).map(
				(p) => p.now - base,
			),
		).toEqual([40000, 42000]);
	});
	it("uses complete sorted unique member sets and cannot collide for equal summaries", () => {
		expect(fleetMemberKey("a", [4, 2, 2, 1])).toBe(
			fleetMemberKey("a", [1, 2, 4]),
		);
		expect(fleetMemberKey("a", [1, 2, 5, 6])).not.toBe(
			fleetMemberKey("a", [1, 3, 4, 6]),
		);
		expect(fleetMemberKey("a", [1])).not.toBe(fleetMemberKey("b", [1]));
		expect(buildFleetTrace(history([0, 1000]), [1])[1].down).toBe(100);
		expect(buildFleetTrace(history([0, 1000]), [2])[1].down).toBe(200);
	});
	it("replays exactly the provider window across more than thirty arrivals and resets", () => {
		const arrivals = [
			100000,
			101000,
			100500,
			102000,
			...Array.from({ length: 42 }, (_, i) => 103000 + i * 1000),
			0,
			1000,
			1000,
			2000,
		];
		let retained: NezhaWebsocketResponse[] = [];
		for (const time of arrivals) {
			retained = [message(time), ...retained].slice(0, 30);
			// 独立参考接收器：只用当前provider窗口，不引用实现函数。
			let accepted: number[] = [];
			for (const item of [...retained].reverse()) {
				const tail = accepted[accepted.length - 1];
				if (tail !== undefined && item.now < tail - 60000) accepted = [];
				else if (tail !== undefined && item.now <= tail) continue;
				accepted.push(item.now);
			}
			expect(buildFleetTrace(retained, [1])).toEqual(
				accepted.map((t) => ({ t, down: 100, up: 10, count: 1 })),
			);
			expect(buildFleetTrace(retained, [1]).length).toBeLessThanOrEqual(30);
		}
		expect(buildFleetTrace(retained.slice(0, 1), [1])).toHaveLength(1);
		expect(buildFleetTrace([], [1])).toEqual([]);
	});
	it("counts only online present members per message, and missing node samples are null", () => {
		const latest = message(10000, [1]);
		latest.servers[0].last_active = new Date(base - 30001).toISOString();
		expect(buildFleetTrace([latest, message(0)], [1])).toEqual([
			{ t: base, down: 100, up: 10, count: 1 },
			{ t: base + 10000, down: 0, up: 0, count: 0 },
		]);
		const traces = buildNodeTraces([latest, message(0)], [1, 2]);
		expect(traces.get(1)?.map((p) => p.value)).toEqual([110, null]);
		expect(traces.get(2)?.map((p) => p.value)).toEqual([220, null]);
	});
	it("breaks gaps and nulls, with time-scaled x coordinates and no fabricated singleton lines", () => {
		const samples = buildFleetTrace(history([0, 1000, 2000, 20000, 21000]));
		const timing = traceTiming(samples);
		expect(timing.gap).toBe(6000);
		const paths = tracePaths(
			samples.map((p) => ({ t: p.t, value: p.down })),
			[base, base + 21000],
			300,
			210,
			100,
			timing.gap,
		);
		expect(paths.line.match(/M/g)).toHaveLength(2);
		expect(paths.line).toContain("L10.00");
		expect(tracePaths([{ t: 1, value: 2 }], [0, 1], 2, 10, 10, 6000).line).toBe(
			"",
		);
	});
});
