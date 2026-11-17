import { createContext, useContext } from "react";
import type { NodeSample } from "@/lib/fleet-trace";

export const HomeDisplayContext = createContext<{
	highDensity: boolean;
	traces: Map<number, NodeSample[]>;
}>({ highDensity: false, traces: new Map() });
export const useHomeDisplay = () => useContext(HomeDisplayContext);
