import { useMemo, useRef } from "react";
import { createFleetTraceReplay, fleetMemberKey } from "@/lib/fleet-trace";
import type { NezhaWebsocketResponse } from "@/types/nezha-api";

export function useFleetTrace(
	history: readonly NezhaWebsocketResponse[],
	groupKey: string,
	memberIds?: readonly number[],
) {
	const key = fleetMemberKey(groupKey, memberIds);
	const members = useMemo(
		() => (JSON.parse(key) as [string, number[] | null])[1] ?? undefined,
		[key],
	);
	const replay = useRef<ReturnType<typeof createFleetTraceReplay> | null>(null);
	if (!replay.current) replay.current = createFleetTraceReplay();
	const compute = replay.current;
	return useMemo(
		() => compute(history, groupKey, members),
		[history, groupKey, members, compute],
	);
}
