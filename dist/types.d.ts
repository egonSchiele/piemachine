export type GraphConfig<T> = {
    debug?: {
        log?: boolean;
        logData?: boolean;
    };
    validation?: {
        func?: (data: T) => Promise<boolean>;
        maxRetries?: number;
    };
    hooks?: {
        beforeNode?: (nodeId: string, data: T) => Promise<T>;
        afterNode?: (nodeId: string, data: T) => Promise<T>;
    };
    statelog?: {
        host: string;
        apiKey: string;
        projectId: string;
        traceId?: string;
        debugMode?: boolean;
    };
};
export type NodeId = string;
export type Edge<T, N extends string> = RegularEdge<N> | ConditionalEdge<T, N>;
export type RegularEdge<N extends string> = {
    type: "regular";
    to: N;
};
export type ConditionalFunc<T, N extends string> = (data: T) => Promise<NoInfer<N>>;
export type ConditionalEdge<T, N extends string> = {
    type: "conditional";
    condition?: ConditionalFunc<T, N>;
    adjacentNodes: readonly N[];
};
export declare function regularEdge<N extends string>(to: N): RegularEdge<N>;
export declare function conditionalEdge<T, N extends string>(condition: ConditionalFunc<T, N> | undefined, adjacentNodes: readonly N[]): ConditionalEdge<T, N>;
export declare function isRegularEdge<T, N extends string>(edge: Edge<T, N>): edge is RegularEdge<N>;
export declare function isConditionalEdge<T, N extends string>(edge: Edge<T, N>): edge is ConditionalEdge<T, N>;
export type JSONEdge = {
    type: "regular";
    to: string;
} | {
    type: "conditional";
    adjacentNodes: readonly string[];
};
export declare function edgeToJSON<T, N extends string>(edge: Edge<T, N>): JSONEdge;
