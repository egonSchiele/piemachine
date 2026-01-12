import { ConditionalFunc, Edge, GraphConfig } from "./types.js";
export declare class GoToNode<T, N extends string> {
    to: N;
    data: T;
    constructor(to: N, data: T);
}
export declare function goToNode<T, N extends string>(to: N, data: T): GoToNode<T, N>;
export declare class Graph<T, N extends string> {
    private nodes;
    private edges;
    private config;
    private statelogClient;
    constructor(config?: GraphConfig<T>);
    node(id: N, func: (data: T) => Promise<T | GoToNode<T, N>>): void;
    edge(from: N, to: N): void;
    conditionalEdge<const Adjacent extends N>(from: N, adjacentNodes: readonly Adjacent[], to?: ConditionalFunc<T, Adjacent>): void;
    debug(message: string, data?: T): void;
    run(startId: N, input: T): Promise<T>;
    runAndValidate(nodeFunc: (data: T) => Promise<T | GoToNode<T, N>>, currentId: N, _data: T, retries?: number): Promise<T | GoToNode<T, N>>;
    prettyPrint(): void;
    prettyPrintEdge(edge: Edge<T, N>): string;
    toMermaid(): string;
    private validateGoToNodeTarget;
}
