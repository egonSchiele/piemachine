import { nanoid } from "nanoid";
import { JSONEdge } from "./types.js";

export class StatelogClient {
  private host: string;
  private debugMode: boolean;
  private tid: string;

  constructor(host: string, debug: boolean = false) {
    this.host = host;
    this.debugMode = debug;
    this.tid = nanoid();
    if (this.debugMode)
      console.log(
        `Statelog client initialized with host: ${host} and TID: ${this.tid}`
      );
  }

  debug(message: string, data: any): void {
    this.post({
      type: "debug",
      message: message,
      data,
    });
  }

  graph({
    nodes,
    edges,
    startNode,
  }: {
    nodes: string[];
    edges: Record<string, JSONEdge[]>;
    startNode?: string;
  }): void {
    this.post({
      type: "graph",
      data: {
        nodes,
        edges,
        startNode,
      },
    });
  }

  enterNode(nodeId: string, data: any): void {
    this.post({
      type: "enterNode",
      nodeId,
      data,
    });
  }

  exitNode(nodeId: string, data: any): void {
    this.post({
      type: "exitNode",
      nodeId,
      data,
    });
  }

  beforeHook(nodeId: string, startData: any, endData: any): void {
    this.post({
      type: "beforeHook",
      nodeId,
      startData,
      endData,
    });
  }

  afterHook(nodeId: string, startData: any, endData: any): void {
    this.post({
      type: "afterHook",
      nodeId,
      startData,
      endData,
    });
  }

  followEdge(
    fromNodeId: string,
    toNodeId: string,
    isConditionalEdge: boolean,
    data: any
  ): void {
    this.post({
      type: "followEdge",
      fromNodeId,
      toNodeId,
      isConditionalEdge,
      data,
    });
  }

  post(body: Record<string, any>): void {
    const fullUrl = new URL("/api/logs", this.host);
    const url = fullUrl.toString();

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tid: this.tid,
        data: { ...body, timeStamp: new Date().toISOString() },
      }),
    }).catch((err) => {
      if (this.debugMode) console.error("Failed to send statelog:", err);
    });
  }
}
