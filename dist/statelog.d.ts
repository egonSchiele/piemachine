import { JSONEdge } from "./types.js";
export declare class StatelogClient {
    private host;
    private debug;
    private tid;
    constructor(host: string, debug?: boolean);
    logDebug(message: string, data: Record<string, any>): void;
    logGraph({ nodes, edges, startNode, }: {
        nodes: string[];
        edges: Record<string, JSONEdge[]>;
        startNode?: string;
    }): void;
    post(body: Record<string, any>): void;
}
