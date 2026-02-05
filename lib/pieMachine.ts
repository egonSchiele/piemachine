import { color } from "termcolors";

import { PieMachineError } from "./error.js";
import { StatelogClient } from "statelog-client";
import {
  conditionalEdge,
  ConditionalFunc,
  Edge,
  edgeToJSON,
  isRegularEdge,
  JSONEdge,
  PieMachineConfig,
  regularEdge,
} from "./types.js";

export class GoToNode<T> {
  constructor(
    public to: string,
    public data: T,
  ) {}
}

export function goToNode<T>(to: string, data: T): GoToNode<T> {
  return new GoToNode(to, data);
}

export class PieMachine<T> {
  private nodes: Partial<
    Record<string, (data: T) => Promise<T | GoToNode<T>>>
  > = {};
  private edges: Partial<Record<string, Edge<T, string>>> = {};
  private config: PieMachineConfig<T>;
  private statelogClient: StatelogClient | null = null;
  private nodesTraversed: string[] = [];
  constructor(nodes: readonly string[], config: PieMachineConfig<T> = {}) {
    this.config = config;
    if (config.statelog) {
      this.statelogClient = new StatelogClient({
        host: config.statelog.host,
        apiKey: config.statelog.apiKey,
        projectId: config.statelog.projectId,
        traceId: config.statelog.traceId,
        debugMode: config.statelog.debugMode ?? false,
      });
    }
  }

  node(id: string, func: (data: T) => Promise<T | GoToNode<T>>): void {
    this.nodes[id] = func;
  }

  edge(from: string, to: string): void {
    if (!this.edges[from]) {
      this.edges[from] = regularEdge(to);
    } else {
      throw new PieMachineError(
        ` ${from} already has an edge, which leads to ${this.edges[from]}.`,
      );
    }
  }

  conditionalEdge<const Adjacent extends string>(
    from: string,
    adjacentNodes: readonly Adjacent[],
    to?: ConditionalFunc<T, Adjacent>,
  ): void {
    if (!this.edges[from]) {
      this.edges[from] = conditionalEdge(to, adjacentNodes);
    } else {
      throw new PieMachineError(
        ` ${from} already has an edge, which leads to ${this.edges[from]}.`,
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

  getNodesTraversed(): readonly string[] {
    return this.nodesTraversed;
  }

  async run(startId: string, input: T): Promise<T> {
    this.nodesTraversed = [];
    const jsonEdges: Record<string, JSONEdge> = {};
    for (const from in this.edges) {
      jsonEdges[from] = edgeToJSON(
        this.edges[from as keyof typeof this.edges]!,
      );
    }
    this.statelogClient?.graph({
      nodes: Object.keys(this.nodes),
      edges: jsonEdges,
      startNode: startId,
    });
    let currentId: string | null = startId;
    let data: T = input;
    while (currentId) {
      this.nodesTraversed.push(currentId);
      const nodeFunc = this.nodes[currentId];

      if (!nodeFunc) {
        throw new PieMachineError(`Node function for ${currentId} not found.`);
      }

      if (this.config.hooks?.beforeNode) {
        this.debug(`Before hook for node: ${color.green(currentId)}`, data);
        const startData = data;
        const startTime = performance.now();
        data = await this.config.hooks!.beforeNode!(currentId, data);
        const endTime = performance.now();
        this.statelogClient?.beforeHook({
          nodeId: currentId,
          startData,
          endData: data,
          timeTaken: endTime - startTime,
        });
      }
      this.debug(`Executing node: ${color.green(currentId)}`, data);
      this.statelogClient?.enterNode({ nodeId: currentId, data });
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
      this.statelogClient?.exitNode({
        nodeId: currentId,
        data,
        timeTaken: endTime - startTime,
      });
      this.debug(`Completed node: ${color.green(currentId)}`, data);

      if (this.config.hooks?.afterNode) {
        this.debug(`After hook for node: ${color.green(currentId)}`, data);
        const startData = data;
        const startTime = performance.now();
        data = await this.config.hooks!.afterNode!(currentId, data);
        const endTime = performance.now();
        this.statelogClient?.afterHook({
          nodeId: currentId,
          startData,
          endData: data,
          timeTaken: endTime - startTime,
        });
      }
      const edge = this.edges[currentId];
      if (edge === undefined) {
        currentId = null as any;
        continue;
      }
      if (nextNode && edge) {
        const isValidTarget = this.validateGoToNodeTarget(nextNode, edge);
        if (!isValidTarget) {
          throw new PieMachineError(
            `${currentId} tried to go to ${nextNode}, but did not specify a conditional edge to it. Use graph.conditionalEdge("${currentId}", ["${nextNode}"]) to define the edge.`,
          );
        }
        this.statelogClient?.followEdge({
          fromNodeId: currentId,
          toNodeId: nextNode as string,
          isConditionalEdge: false,
          data,
        });
        this.debug(
          `Following goto edge to: ${color.green(nextNode as string)}`,
          data,
        );
        currentId = nextNode;
        continue;
      }
      if (isRegularEdge(edge)) {
        this.statelogClient?.followEdge({
          fromNodeId: currentId,
          toNodeId: edge.to,
          isConditionalEdge: false,
          data,
        });
        this.debug(`Following regular edge to: ${color.green(edge.to)}`);
        currentId = edge.to;
      } else {
        if (edge.condition) {
          const nextId = await edge.condition(data);
          this.statelogClient?.followEdge({
            fromNodeId: currentId,
            toNodeId: nextId,
            isConditionalEdge: true,
            data,
          });
          this.debug(
            `Following conditional edge to: ${color.green(nextId)}`,
            data,
          );
          currentId = nextId;
        } else {
          this.debug(`Exiting graph from node: ${color.green(currentId)}`);
          currentId = null;
          /* throw new PieMachineError(
            `Expected ${currentId} to return a GoToNode, as no function was specified for the conditional edges to ${edge.adjacentNodes.join(", ")}.`,
          ); */
        }
      }
    }
    return data;
  }

  async runAndValidate(
    nodeFunc: (data: T) => Promise<T | GoToNode<T>>,
    currentId: string,
    _data: T,
    retries = 0,
  ): Promise<T | GoToNode<T>> {
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
          throw new PieMachineError(
            `Validation failed for node ${currentId} after ${maxRetries} retries.`,
          );
        }
        this.debug(
          `Validation failed for node ${color.green(currentId)}, retrying... (${
            retries + 1
          }/${maxRetries})`,
          data,
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

  prettyPrintEdge(edge: Edge<T, string>): string {
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

  merge(another: PieMachine<T>): void {
    for (const nodeId in another.nodes) {
      if (this.nodes[nodeId as keyof typeof this.nodes]) {
        throw new PieMachineError(
          `Node ${nodeId} already exists in the current PieMachine.`,
        );
      }
      this.nodes[nodeId as keyof typeof this.nodes] =
        another.nodes[nodeId as keyof typeof another.nodes];
    }
    for (const from in another.edges) {
      if (this.edges[from as keyof typeof this.edges]) {
        throw new PieMachineError(
          `Edge from ${from} already exists in the current PieMachine.`,
        );
      }
      this.edges[from as keyof typeof this.edges] =
        another.edges[from as keyof typeof another.edges];
    }
  }

  private validateGoToNodeTarget(to: string, edge: Edge<T, string>): boolean {
    if (!isRegularEdge(edge)) {
      if (edge.adjacentNodes.includes(to)) {
        return true;
      }
    }
    return false;
  }
}
