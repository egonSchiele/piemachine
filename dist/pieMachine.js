var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { color } from "termcolors";
import { PieMachineError } from "./error.js";
import { StatelogClient } from "statelog-client";
import { conditionalEdge, edgeToJSON, isRegularEdge, regularEdge, } from "./types.js";
export class GoToNode {
    constructor(to, data) {
        this.to = to;
        this.data = data;
    }
}
export function goToNode(to, data) {
    return new GoToNode(to, data);
}
export class PieMachine {
    constructor(nodes, config = {}) {
        var _a;
        this.nodes = {};
        this.edges = {};
        this.statelogClient = null;
        this.config = config;
        if (config.statelog) {
            this.statelogClient = new StatelogClient({
                host: config.statelog.host,
                apiKey: config.statelog.apiKey,
                projectId: config.statelog.projectId,
                traceId: config.statelog.traceId,
                debugMode: (_a = config.statelog.debugMode) !== null && _a !== void 0 ? _a : false,
            });
        }
    }
    node(id, func) {
        this.nodes[id] = func;
    }
    edge(from, to) {
        if (!this.edges[from]) {
            this.edges[from] = regularEdge(to);
        }
        else {
            throw new PieMachineError(` ${from} already has an edge, which leads to ${this.edges[from]}.`);
        }
    }
    conditionalEdge(from, adjacentNodes, to) {
        if (!this.edges[from]) {
            this.edges[from] = conditionalEdge(to, adjacentNodes);
        }
        else {
            throw new PieMachineError(` ${from} already has an edge, which leads to ${this.edges[from]}.`);
        }
    }
    debug(message, data) {
        var _a, _b;
        let debugStr = `${color.magenta("[DEBUG]")}: ${message}`;
        if (((_a = this.config.debug) === null || _a === void 0 ? void 0 : _a.logData) && data !== undefined) {
            debugStr += ` | Data: ${color.green(JSON.stringify(data))}`;
        }
        if ((_b = this.config.debug) === null || _b === void 0 ? void 0 : _b.log) {
            console.log(debugStr);
        }
        //this.statelogClient?.debug(message, data || {});
    }
    run(startId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            const jsonEdges = {};
            for (const from in this.edges) {
                jsonEdges[from] = edgeToJSON(this.edges[from]);
            }
            (_a = this.statelogClient) === null || _a === void 0 ? void 0 : _a.graph({
                nodes: Object.keys(this.nodes),
                edges: jsonEdges,
                startNode: startId,
            });
            let currentId = startId;
            let data = input;
            while (currentId) {
                const nodeFunc = this.nodes[currentId];
                if (!nodeFunc) {
                    throw new PieMachineError(`Node function for ${currentId} not found.`);
                }
                if ((_b = this.config.hooks) === null || _b === void 0 ? void 0 : _b.beforeNode) {
                    this.debug(`Before hook for node: ${color.green(currentId)}`, data);
                    const startData = data;
                    const startTime = performance.now();
                    data = yield this.config.hooks.beforeNode(currentId, data);
                    const endTime = performance.now();
                    (_c = this.statelogClient) === null || _c === void 0 ? void 0 : _c.beforeHook({
                        nodeId: currentId,
                        startData,
                        endData: data,
                        timeTaken: endTime - startTime,
                    });
                }
                this.debug(`Executing node: ${color.green(currentId)}`, data);
                (_d = this.statelogClient) === null || _d === void 0 ? void 0 : _d.enterNode({ nodeId: currentId, data });
                const startTime = performance.now();
                const result = yield this.runAndValidate(nodeFunc, currentId, data);
                const endTime = performance.now();
                let nextNode;
                if (result instanceof GoToNode) {
                    nextNode = result.to;
                    data = result.data;
                }
                else {
                    data = result;
                }
                (_e = this.statelogClient) === null || _e === void 0 ? void 0 : _e.exitNode({
                    nodeId: currentId,
                    data,
                    timeTaken: endTime - startTime,
                });
                this.debug(`Completed node: ${color.green(currentId)}`, data);
                if ((_f = this.config.hooks) === null || _f === void 0 ? void 0 : _f.afterNode) {
                    this.debug(`After hook for node: ${color.green(currentId)}`, data);
                    const startData = data;
                    const startTime = performance.now();
                    data = yield this.config.hooks.afterNode(currentId, data);
                    const endTime = performance.now();
                    (_g = this.statelogClient) === null || _g === void 0 ? void 0 : _g.afterHook({
                        nodeId: currentId,
                        startData,
                        endData: data,
                        timeTaken: endTime - startTime,
                    });
                }
                const edge = this.edges[currentId];
                if (edge === undefined) {
                    currentId = null;
                    continue;
                }
                if (nextNode && edge) {
                    const isValidTarget = this.validateGoToNodeTarget(nextNode, edge);
                    if (!isValidTarget) {
                        throw new PieMachineError(`${currentId} tried to go to ${nextNode}, but did not specify a conditional edge to it. Use graph.conditionalEdge("${currentId}", ["${nextNode}"]) to define the edge.`);
                    }
                    (_h = this.statelogClient) === null || _h === void 0 ? void 0 : _h.followEdge({
                        fromNodeId: currentId,
                        toNodeId: nextNode,
                        isConditionalEdge: false,
                        data,
                    });
                    this.debug(`Following goto edge to: ${color.green(nextNode)}`, data);
                    currentId = nextNode;
                    continue;
                }
                if (isRegularEdge(edge)) {
                    (_j = this.statelogClient) === null || _j === void 0 ? void 0 : _j.followEdge({
                        fromNodeId: currentId,
                        toNodeId: edge.to,
                        isConditionalEdge: false,
                        data,
                    });
                    this.debug(`Following regular edge to: ${color.green(edge.to)}`);
                    currentId = edge.to;
                }
                else {
                    if (edge.condition) {
                        const nextId = yield edge.condition(data);
                        (_k = this.statelogClient) === null || _k === void 0 ? void 0 : _k.followEdge({
                            fromNodeId: currentId,
                            toNodeId: nextId,
                            isConditionalEdge: true,
                            data,
                        });
                        this.debug(`Following conditional edge to: ${color.green(nextId)}`, data);
                        currentId = nextId;
                    }
                    else {
                        this.debug(`Exiting graph from node: ${color.green(currentId)}`);
                        currentId = null;
                        /* throw new PieMachineError(
                          `Expected ${currentId} to return a GoToNode, as no function was specified for the conditional edges to ${edge.adjacentNodes.join(", ")}.`,
                        ); */
                    }
                }
            }
            return data;
        });
    }
    runAndValidate(nodeFunc_1, currentId_1, _data_1) {
        return __awaiter(this, arguments, void 0, function* (nodeFunc, currentId, _data, retries = 0) {
            var _a, _b;
            const result = yield nodeFunc(_data);
            let data;
            if (result instanceof GoToNode) {
                data = result.data;
            }
            else {
                data = result;
            }
            if ((_a = this.config.validation) === null || _a === void 0 ? void 0 : _a.func) {
                const maxRetries = (_b = this.config.validation.maxRetries) !== null && _b !== void 0 ? _b : 0;
                let isValid = yield this.config.validation.func(data);
                while (!isValid) {
                    if (retries >= maxRetries) {
                        throw new PieMachineError(`Validation failed for node ${currentId} after ${maxRetries} retries.`);
                    }
                    this.debug(`Validation failed for node ${color.green(currentId)}, retrying... (${retries + 1}/${maxRetries})`, data);
                    return this.runAndValidate(nodeFunc, currentId, _data, retries + 1);
                }
            }
            return result;
        });
    }
    prettyPrint() {
        for (const from in this.edges) {
            const to = this.edges[from];
            if (!to)
                continue;
            console.log(`${from} -> ${this.prettyPrintEdge(to)}`);
        }
    }
    prettyPrintEdge(edge) {
        if (isRegularEdge(edge)) {
            return edge.to;
        }
        else {
            return edge.adjacentNodes.join(" | ");
        }
    }
    toMermaid() {
        let mermaid = "graph TD\n";
        for (const from in this.edges) {
            const to = this.edges[from];
            if (!to)
                continue;
            if (isRegularEdge(to)) {
                mermaid += `  ${from} --> ${to.to}\n`;
            }
            else {
                to.adjacentNodes.forEach((adjNode) => {
                    mermaid += `  ${from} --> ${adjNode}\n`;
                });
            }
        }
        return mermaid;
    }
    validateGoToNodeTarget(to, edge) {
        if (!isRegularEdge(edge)) {
            if (edge.adjacentNodes.includes(to)) {
                return true;
            }
        }
        return false;
    }
}
