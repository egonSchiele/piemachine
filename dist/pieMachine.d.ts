import { ConditionalFunc, Edge, PieMachineConfig } from "./types.js";
export declare class GoToNode<T> {
    to: string;
    data: T;
    constructor(to: string, data: T);
}
export declare function goToNode<T>(to: string, data: T): GoToNode<T>;
export declare class PieMachine<T> {
    private nodes;
    private edges;
    private config;
    private statelogClient;
    private nodesTraversed;
    constructor(config?: PieMachineConfig<T>);
    node(id: string, func: (data: T) => Promise<T | GoToNode<T>>): void;
    edge(from: string, to: string): void;
    conditionalEdge<const Adjacent extends string>(from: string, adjacentNodes: readonly Adjacent[], to?: ConditionalFunc<T, Adjacent>): void;
    debug(message: string, data?: T): void;
    getNodesTraversed(): readonly string[];
    run(startId: string, input: T): Promise<T>;
    runAndValidate(nodeFunc: (data: T) => Promise<T | GoToNode<T>>, currentId: string, _data: T, retries?: number): Promise<T | GoToNode<T>>;
    prettyPrint(): void;
    prettyPrintEdge(edge: Edge<T, string>): string;
    toMermaid(): string;
    merge(another: PieMachine<T>): void;
    toJSON(): {
        nodes: string[];
        edges: Record<string, string[]>;
        config: {
            debug: {
                log?: boolean;
                logData?: boolean;
            } | undefined;
        };
    };
    private validateGoToNodeTarget;
}
