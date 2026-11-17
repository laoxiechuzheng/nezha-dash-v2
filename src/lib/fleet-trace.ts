import type { NezhaServer, NezhaWebsocketResponse } from "@/types/nezha-api";

export type FleetSample = {
	t: number;
	down: number;
	up: number;
	count: number;
};
export type NodeSample = { t: number; value: number | null };
export const TRACE_LIMIT = 30;

/** 完整成员集合是缓存键，不能用长度/极值/和替代（这些摘要会碰撞）。 */
export function fleetMemberKey(groupKey: string, ids?: readonly number[]) {
	return JSON.stringify([
		groupKey,
		ids ? [...new Set(ids)].sort((a, b) => a - b) : null,
	]);
}

export function isFleetOnline(now: number, server: NezhaServer) {
	const last = server.last_active.startsWith("000")
		? 0
		: Date.parse(server.last_active);
	return now - last <= 30_000;
}

/** provider 最新在前；按到达顺序接收，不按时间排序，避免乱序数据复活。 */
export function acceptTraceMessages(
	history: readonly NezhaWebsocketResponse[],
) {
	const accepted: NezhaWebsocketResponse[] = [];
	for (let i = Math.min(history.length, TRACE_LIMIT) - 1; i >= 0; i--) {
		const message = history[i];
		if (!Number.isFinite(message.now)) continue;
		const previous = accepted[accepted.length - 1];
		if (previous && message.now < previous.now - 60_000) accepted.length = 0;
		else if (previous && message.now <= previous.now) continue;
		accepted.push(message);
	}
	return accepted;
}

const rate = (value: number) =>
	Number.isFinite(value) && value > 0 ? value : 0;

/** 有界 30 条全量路径：滚动窗口、重置、乱序和回拨使用同一个确定性算法。 */
export function buildFleetTrace(
	history: readonly NezhaWebsocketResponse[],
	memberIds?: readonly number[],
): FleetSample[] {
	const members = memberIds ? new Set(memberIds) : null;
	return acceptTraceMessages(history).map((message) =>
		aggregateFleetMessage(message, members),
	);
}

function aggregateFleetMessage(
	message: NezhaWebsocketResponse,
	members: Set<number> | null,
): FleetSample {
	const sample: FleetSample = { t: message.now, down: 0, up: 0, count: 0 };
	for (const server of message.servers) {
		if (
			(members && !members.has(server.id)) ||
			!isFleetOnline(message.now, server)
		)
			continue;
		sample.down += rate(server.state?.net_in_speed);
		sample.up += rate(server.state?.net_out_speed);
		sample.count++;
	}
	return sample;
}

/** 只缓存不可变消息对象的合计；每次仍完整重放接收规则，窗口边界不带入旧纪元状态。 */
export function createFleetTraceReplay() {
	let previousKey = "";
	let cached = new Map<NezhaWebsocketResponse, FleetSample>();
	return (
		history: readonly NezhaWebsocketResponse[],
		groupKey: string,
		memberIds?: readonly number[],
	) => {
		const key = fleetMemberKey(groupKey, memberIds);
		if (key !== previousKey) {
			cached.clear();
			previousKey = key;
		}
		const members = memberIds ? new Set(memberIds) : null;
		const retained = new Map<NezhaWebsocketResponse, FleetSample>();
		const samples = acceptTraceMessages(history).map((message) => {
			const sample =
				cached.get(message) ?? aggregateFleetMessage(message, members);
			retained.set(message, sample);
			return sample;
		});
		cached = retained;
		return samples;
	};
}

/** 仅正常密度调用一次；缺失或离线必须留下 null，不能伪造为零吞吐。 */
export function buildNodeTraces(
	history: readonly NezhaWebsocketResponse[],
	memberIds: readonly number[],
) {
	const messages = acceptTraceMessages(history);
	const traces = new Map<number, NodeSample[]>();
	for (const id of new Set(memberIds))
		traces.set(
			id,
			messages.map((message) => ({ t: message.now, value: null })),
		);
	messages.forEach((message, index) => {
		for (const server of message.servers) {
			const trace = traces.get(server.id);
			if (!trace || !isFleetOnline(message.now, server)) continue;
			const down = server.state?.net_in_speed;
			const up = server.state?.net_out_speed;
			if (!Number.isFinite(down) || !Number.isFinite(up)) continue;
			trace[index].value = rate(down) + rate(up);
		}
	});
	return traces;
}

export function traceTiming(samples: readonly { t: number }[]) {
	const intervals = samples
		.slice(1)
		.map((sample, i) => sample.t - samples[i].t)
		.filter((dt) => dt > 0)
		.sort((a, b) => a - b);
	const middle = Math.floor(intervals.length / 2);
	const interval = intervals.length
		? intervals.length % 2
			? intervals[middle]
			: (intervals[middle - 1] + intervals[middle]) / 2
		: 0;
	return {
		span: samples.length > 1 ? samples[samples.length - 1].t - samples[0].t : 0,
		interval,
		gap: Math.max(6_000, interval * 3),
		count: samples.length,
	};
}

export function niceTraceMax(value: number) {
	if (!(value > 0)) return 1;
	const power = 10 ** Math.floor(Math.log10(value));
	const scaled = value / power;
	return (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10) * power;
}

/** 一个多子路径表示全部断线段，DOM 数不随 gap 数增加。 */
export function tracePaths(
	points: readonly { t: number; value: number | null }[],
	domain: [number, number],
	max: number,
	width: number,
	height: number,
	gap: number,
) {
	let line = "";
	let area = "";
	let segment: [number, number][] = [];
	let previous: number | null = null;
	const flush = () => {
		if (segment.length >= 2) {
			const path = segment
				.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`)
				.join(" ");
			line += `${path} `;
			area += `${path} L${segment[segment.length - 1][0].toFixed(2)},${height} L${segment[0][0].toFixed(2)},${height} Z `;
		}
		segment = [];
	};
	for (const point of points) {
		if (point.value === null || (previous !== null && point.t - previous > gap))
			flush();
		if (point.value !== null)
			segment.push([
				((point.t - domain[0]) / Math.max(1, domain[1] - domain[0])) * width,
				height - (point.value / max) * height,
			]);
		previous = point.t;
	}
	flush();
	return { line: line.trim(), area: area.trim() };
}
