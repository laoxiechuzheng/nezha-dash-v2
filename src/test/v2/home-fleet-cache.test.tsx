import { describe, expect, it } from "vitest";
import { buildFleetTrace, createFleetTraceReplay } from "@/lib/fleet-trace";
import { createServer } from "@/test/fixtures";
import type { NezhaWebsocketResponse } from "@/types/nezha-api";

const base = Date.parse("2025-01-01T00:00:00Z");
const message = (offset: number): NezhaWebsocketResponse => ({
	now: base + offset,
	servers: [1, 2, 3].map((id) =>
		createServer({
			id,
			last_active: new Date(base + offset).toISOString(),
			state: { net_in_speed: id * 100 + offset, net_out_speed: id * 10 },
		}),
	),
});
describe("bounded message aggregate cache with full replay acceptance", () => {
	it("matches full recomputation at every window, group/member change, reorder, duplicate, rollback and reset", () => {
		const replay = createFleetTraceReplay();
		let history: NezhaWebsocketResponse[] = [];
		const arrivals = [
			0,
			1000,
			1000,
			500,
			2000,
			...Array.from({ length: 50 }, (_, i) => 3000 + i * 1000),
			-100000,
			-99000,
			-100000,
			-98000,
		];
		for (const offset of arrivals) {
			history = [message(offset), ...history].slice(0, 30);
			for (const ids of [[1, 2], [2, 3], [1, 2, 3], undefined])
				expect(replay(history, "g", ids)).toEqual(
					buildFleetTrace(history, ids),
				);
			expect(replay(history, "other", [1])).toEqual(
				buildFleetTrace(history, [1]),
			);
		}
		expect(replay(history.slice(0, 2), "g", [2])).toEqual(
			buildFleetTrace(history.slice(0, 2), [2]),
		);
		expect(replay([], "g", [2])).toEqual([]);
		expect(replay([message(10)], "g", [1])).toEqual(
			buildFleetTrace([message(10)], [1]),
		);
	});
	it("keeps a warm same-key cache correct across eviction, duplicate timestamps and clock rollback", () => {
		const replay = createFleetTraceReplay();
		let history: NezhaWebsocketResponse[] = [];
		let previous = new Map<
			number,
			ReturnType<typeof buildFleetTrace>[number]
		>();
		const offsets = [
			...Array.from({ length: 65 }, (_, index) => index * 1000),
			64000,
			63000,
			65000,
			-100000,
			-99000,
			...Array.from({ length: 35 }, (_, index) => -98000 + index * 1000),
		];
		for (const offset of offsets) {
			history = [message(offset), ...history].slice(0, 30);
			const actual = replay(history, "stable-group", [1, 2]);
			expect(actual).toEqual(buildFleetTrace(history, [1, 2]));
			expect(actual.length).toBeLessThanOrEqual(30);
			for (const sample of actual) {
				// 两台在线节点的原始字段给出独立期望，不只用两个实现互相比对。
				expect(sample).toEqual({
					t: sample.t,
					down:
						Math.max(0, 100 + sample.t - base) +
						Math.max(0, 200 + sample.t - base),
					up: 30,
					count: 2,
				});
				if (previous.has(sample.t)) expect(sample).toBe(previous.get(sample.t));
			}
			previous = new Map(actual.map((sample) => [sample.t, sample]));
		}
		expect(replay([], "stable-group", [1, 2])).toEqual([]);
		const fresh = message(123000);
		expect(replay([fresh], "stable-group", [1, 2])).toEqual(
			buildFleetTrace([fresh], [1, 2]),
		);
	});
	it("reuses unchanged immutable message aggregates while keeping at most thirty messages", () => {
		const replay = createFleetTraceReplay();
		const old = message(0),
			recent = message(1000);
		const first = replay([old], "g");
		const next = replay([recent, old], "g");
		expect(next[0]).toBe(first[0]);
		expect(next).toEqual(buildFleetTrace([recent, old]));
		const changed = replay([recent, old], "g", [1]);
		expect(changed[0]).not.toBe(first[0]);
		expect(changed).toEqual(buildFleetTrace([recent, old], [1]));
	});
});
