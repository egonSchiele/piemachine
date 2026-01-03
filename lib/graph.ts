import { color } from "termcolors";

import { GraphError } from "./error.js";
import { StatelogClient } from "./statelog.js";
import {
  conditionalEdge,
  ConditionalFunc,
  Edge,
  edgeToJSON,
  GraphConfig,
  isRegularEdge,
  JSONEdge,
  regularEdge,
} from "./types.js";

export class Graph<T, N extends string> {
  private nodes: Partial<Record<N, (data: T) => Promise<T>>> = {};
  private edges: Partial<Record<N, Edge<T, N>[]>> = {};
  private config: GraphConfig<T>;
  private statelogClient: StatelogClient | null = null;
  constructor(nodes: readonly N[], config: GraphConfig<T> = {}) {
    this.config = config;
    if (config.statelogHost) {
      this.statelogClient = new StatelogClient(
        config.statelogHost,
        config.debug?.log ?? false
      );
    }
  }

  node(id: N, func: (data: T) => Promise<T>): void {
    this.nodes[id] = func;
    if (!this.edges[id]) {
      this.edges[id] = [];
    }
  }

  edge(from: N, to: N): void {
    if (!this.edges[from]) {
      this.edges[from] = [];
    }
    this.edges[from].push(regularEdge(to));
  }

  conditionalEdge<const Adjacent extends N>(
    from: N,
    adjacentNodes: readonly Adjacent[],
    to: ConditionalFunc<T, Adjacent>
  ): void {
    if (!this.edges[from]) {
      this.edges[from] = [];
    }
    this.edges[from].push(conditionalEdge(to, adjacentNodes));
  }

  debug(message: string, data?: T): void {
    let debugStr = `${color.magenta("[DEBUG]")}: ${message}`;
    if (this.config.debug?.logData && data !== undefined) {
      debugStr += ` | Data: ${color.green(JSON.stringify(data))}`;
    }
    if (this.config.debug?.log) {
      console.log(debugStr);
    }
    //this.statelogClient?.debug(message, data || {});
  }

  async run(startId: N, input: T): Promise<T> {
    const jsonEdges: Record<string, JSONEdge[]> = {};
    for (const from in this.edges) {
      jsonEdges[from] =
        this.edges[from as keyof typeof this.edges]!.map(edgeToJSON);
    }
    this.statelogClient?.graph({
      nodes: Object.keys(this.nodes),
      edges: jsonEdges,
      startNode: startId,
    });
    const stack: N[] = [startId];
    let data: T = input;
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      const nodeFunc = this.nodes[currentId];

      if (!nodeFunc) {
        throw new GraphError(`Node function for ${currentId} not found.`);
      }

      if (this.config.hooks?.beforeNode) {
        this.debug(`Before hook for node: ${color.green(currentId)}`, data);
        const startData = data;
        const startTime = performance.now();
        data = await this.config.hooks!.beforeNode!(currentId, data);
        const endTime = performance.now();
        this.statelogClient?.beforeHook(
          currentId,
          startData,
          data,
          endTime - startTime
        );
      }
      this.debug(`Executing node: ${color.green(currentId)}`, data);
      this.statelogClient?.enterNode(currentId, data);
      const startTime = performance.now();
      data = await this.runAndValidate(nodeFunc, currentId, data);
      const endTime = performance.now();
      this.statelogClient?.exitNode(currentId, data, endTime - startTime);
      this.debug(`Completed node: ${color.green(currentId)}`, data);

      if (this.config.hooks?.afterNode) {
        this.debug(`After hook for node: ${color.green(currentId)}`, data);
        const startData = data;
        const startTime = performance.now();
        data = await this.config.hooks!.afterNode!(currentId, data);
        const endTime = performance.now();
        this.statelogClient?.afterHook(
          currentId,
          startData,
          data,
          endTime - startTime
        );
      }

      const edges = this.edges[currentId] || [];
      for (const edge of edges) {
        if (isRegularEdge(edge)) {
          stack.push(edge.to);
          this.statelogClient?.followEdge(currentId, edge.to, false, data);
          this.debug(`Following regular edge to: ${color.green(edge.to)}`);
        } else {
          const nextId = await edge.condition(data);
          this.statelogClient?.followEdge(currentId, nextId, true, data);
          this.debug(
            `Following conditional edge to: ${color.green(nextId)}`,
            data
          );
          stack.push(nextId);
        }
      }
    }
    return data;
  }

  async runAndValidate(
    nodeFunc: (data: T) => Promise<T>,
    currentId: N,
    _data: T
  ): Promise<T> {
    let data = await nodeFunc(_data);

    if (this.config.validation?.func) {
      let retries = 0;
      const maxRetries = this.config.validation.maxRetries ?? 0;
      let isValid = this.config.validation.func(data);
      while (!isValid) {
        if (retries >= maxRetries) {
          throw new GraphError(
            `Validation failed for node ${currentId} after ${maxRetries} retries.`
          );
        }
        this.debug(
          `Validation failed for node ${color.green(currentId)}, retrying... (${
            retries + 1
          }/${maxRetries})`,
          data
        );
        data = await nodeFunc(data);
        isValid = this.config.validation.func(data);
        retries++;
      }
    }
    return data;
  }

  prettyPrint(): void {
    for (const from in this.edges) {
      for (const to of this.edges[from as keyof typeof this.edges]!) {
        console.log(`${from} -> ${this.prettyPrintEdge(to)}`);
      }
    }
  }

  prettyPrintEdge(edge: Edge<T, N>): string {
    if (isRegularEdge(edge)) {
      return edge.to;
    } else {
      return edge.adjacentNodes.join(" | ");
    }
  }

  toMermaid(): string {
    let mermaid = "graph TD\n";
    for (const from in this.edges) {
      for (const to of this.edges[from as keyof typeof this.edges]!) {
        if (isRegularEdge(to)) {
          mermaid += `  ${from} --> ${to.to}\n`;
        } else {
          to.adjacentNodes.forEach((adjNode) => {
            mermaid += `  ${from} --> ${adjNode}\n`;
          });
        }
      }
    }
    return mermaid;
  }
}
