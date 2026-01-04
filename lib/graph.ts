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

export class GoToNode<T, N extends string> {
  constructor(
    public to: N,
    public data: T
  ) {}
}

export function goToNode<T, N extends string>(to: N, data: T): GoToNode<T, N> {
  return new GoToNode(to, data);
}

export class Graph<T, N extends string> {
  private nodes: Partial<Record<N, (data: T) => Promise<T | GoToNode<T, N>>>> =
    {};
  private edges: Partial<Record<N, Edge<T, N>>> = {};
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

  node(id: N, func: (data: T) => Promise<T | GoToNode<T, N>>): void {
    this.nodes[id] = func;
  }

  edge(from: N, to: N): void {
    if (!this.edges[from]) {
      this.edges[from] = regularEdge(to);
    } else {
      throw new GraphError(
        ` ${from} already has an edge, which leads to ${this.edges[from]}.`
      );
    }
  }

  conditionalEdge<const Adjacent extends N>(
    from: N,
    adjacentNodes: readonly Adjacent[],
    to?: ConditionalFunc<T, Adjacent>
  ): void {
    if (!this.edges[from]) {
      this.edges[from] = conditionalEdge(to, adjacentNodes);
    } else {
      throw new GraphError(
        ` ${from} already has an edge, which leads to ${this.edges[from]}.`
      );
    }
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
    const jsonEdges: Record<string, JSONEdge> = {};
    for (const from in this.edges) {
      jsonEdges[from] = edgeToJSON(
        this.edges[from as keyof typeof this.edges]!
      );
    }
    this.statelogClient?.graph({
      nodes: Object.keys(this.nodes),
      edges: jsonEdges,
      startNode: startId,
    });
    let currentId: N | null = startId;
    let data: T = input;
    while (currentId) {
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
      const result = await this.runAndValidate(nodeFunc, currentId, data);
      const endTime = performance.now();
      let nextNode;
      if (result instanceof GoToNode) {
        nextNode = result.to;
        data = result.data;
      } else {
        data = result;
      }
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
      const edge = this.edges[currentId];
      if (edge === undefined) {
        currentId = null as any;
        continue;
      }
      if (nextNode && edge) {
        const isValidTarget = this.validateGoToNodeTarget(nextNode, edge);
        if (!isValidTarget) {
          throw new GraphError(
            `${currentId} tried to go to ${nextNode}, but did not specify a conditional edge to it. Use graph.conditionalEdge("${currentId}", ["${nextNode}"]) to define the edge.`
          );
        }
        this.statelogClient?.followEdge(
          currentId,
          nextNode as string,
          false,
          data
        );
        this.debug(
          `Following goto edge to: ${color.green(nextNode as string)}`,
          data
        );
        currentId = nextNode as N;
        continue;
      }

      if (isRegularEdge(edge)) {
        this.statelogClient?.followEdge(currentId, edge.to, false, data);
        this.debug(`Following regular edge to: ${color.green(edge.to)}`);
        currentId = edge.to;
      } else {
        if (edge.condition) {
          const nextId = await edge.condition(data);
          this.statelogClient?.followEdge(currentId, nextId, true, data);
          this.debug(
            `Following conditional edge to: ${color.green(nextId)}`,
            data
          );
          currentId = nextId;
        } else {
          throw new GraphError(
            `Expected ${currentId} to return a GoToNode, as no function was specified for the conditional edges to ${edge.adjacentNodes.join(", ")}.`
          );
        }
      }
    }
    return data;
  }

  async runAndValidate(
    nodeFunc: (data: T) => Promise<T | GoToNode<T, N>>,
    currentId: N,
    _data: T,
    retries = 0
  ): Promise<T | GoToNode<T, N>> {
    const result = await nodeFunc(_data);
    let data: T;
    if (result instanceof GoToNode) {
      data = result.data;
    } else {
      data = result;
    }
    if (this.config.validation?.func) {
      const maxRetries = this.config.validation.maxRetries ?? 0;
      let isValid = await this.config.validation.func(data);
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
        return this.runAndValidate(nodeFunc, currentId, _data, retries + 1);
      }
    }
    return result;
  }

  prettyPrint(): void {
    for (const from in this.edges) {
      const to = this.edges[from as keyof typeof this.edges];
      if (!to) continue;
      console.log(`${from} -> ${this.prettyPrintEdge(to)}`);
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
      const to = this.edges[from as keyof typeof this.edges];
      if (!to) continue;

      if (isRegularEdge(to)) {
        mermaid += `  ${from} --> ${to.to}\n`;
      } else {
        to.adjacentNodes.forEach((adjNode) => {
          mermaid += `  ${from} --> ${adjNode}\n`;
        });
      }
    }
    return mermaid;
  }

  private validateGoToNodeTarget(to: string, edge: Edge<T, N>): boolean {
    if (!isRegularEdge(edge)) {
      if (edge.adjacentNodes.includes(to as N)) {
        return true;
      }
    }
    return false;
  }
}
