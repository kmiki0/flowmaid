import type { FlowState } from "./types";

export const selectNodes = (s: FlowState) => s.nodes;
export const selectEdges = (s: FlowState) => s.edges;
export const selectDirection = (s: FlowState) => s.direction;
