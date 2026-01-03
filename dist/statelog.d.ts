import { JSONEdge } from "./types.js";
export declare class StatelogClient {
    private host;
    private debugMode;
    private tid;
    constructor(host: string, debug?: boolean);
    debug(message: string, data: any): void;
    graph({ nodes, edges, startNode, }: {
        nodes: string[];
        edges: Record<string, JSONEdge[]>;
        startNode?: string;
    }): void;
    enterNode(nodeId: string, data: any): void;
    exitNode(nodeId: string, data: any): void;
    beforeHook(nodeId: string, startData: any, endData: any): void;
    afterHook(nodeId: string, startData: any, endData: any): void;
    followEdge(fromNodeId: string, toNodeId: string, isConditionalEdge: boolean, data: any): void;
    post(body: Record<string, any>): void;
}
