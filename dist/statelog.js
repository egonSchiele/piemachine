import { nanoid } from "nanoid";
export class StatelogClient {
    constructor(host, debug = false) {
        this.host = host;
        this.debugMode = debug;
        this.tid = nanoid();
        if (this.debugMode)
            console.log(`Statelog client initialized with host: ${host} and TID: ${this.tid}`);
    }
    debug(message, data) {
        this.post({
            type: "debug",
            message: message,
            data,
        });
    }
    graph({ nodes, edges, startNode, }) {
        this.post({
            type: "graph",
            nodes,
            edges,
            startNode,
        });
    }
    enterNode(nodeId, data) {
        this.post({
            type: "enterNode",
            nodeId,
            data,
        });
    }
    exitNode(nodeId, data, timeTaken) {
        this.post({
            type: "exitNode",
            nodeId,
            data,
            timeTaken,
        });
    }
    beforeHook(nodeId, startData, endData, timeTaken) {
        this.post({
            type: "beforeHook",
            nodeId,
            startData,
            endData,
            timeTaken,
        });
    }
    afterHook(nodeId, startData, endData, timeTaken) {
        this.post({
            type: "afterHook",
            nodeId,
            startData,
            endData,
            timeTaken,
        });
    }
    followEdge(fromNodeId, toNodeId, isConditionalEdge, data) {
        this.post({
            type: "followEdge",
            edgeId: `${fromNodeId}->${toNodeId}`,
            fromNodeId,
            toNodeId,
            isConditionalEdge,
            data,
        });
    }
    post(body) {
        const fullUrl = new URL("/api/logs", this.host);
        const url = fullUrl.toString();
        fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                tid: this.tid,
                data: Object.assign(Object.assign({}, body), { timeStamp: new Date().toISOString() }),
            }),
        }).catch((err) => {
            if (this.debugMode)
                console.error("Failed to send statelog:", err);
        });
    }
}
