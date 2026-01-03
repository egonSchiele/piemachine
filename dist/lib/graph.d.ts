import { ConditionalFunc, Edge, GraphConfig } from "./types.js";
export declare class Graph<T, N extends string> {
    private nodes;
    private edges;
    private config;
    private statelogClient;
    constructor(nodes: readonly N[], config?: GraphConfig<T>);
    node(id: N, func: (data: T) => Promise<T>): void;
    edge(from: N, to: N): void;
    conditionalEdge<const Adjacent extends N>(from: N, adjacentNodes: readonly Adjacent[], to: ConditionalFunc<T, Adjacent>): void;
    debug(str: string, data?: T): void;
    run(startId: N, input: T): Promise<T>;
    runAndValidate(nodeFunc: (data: T) => Promise<T>, currentId: N, _data: T): Promise<T>;
    prettyPrint(): void;
    prettyPrintEdge(edge: Edge<T, N>): string;
    toMermaid(): string;
}
