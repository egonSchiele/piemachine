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
import { GraphError } from "./error.js";
import { StatelogClient } from "./statelog.js";
import { conditionalEdge, edgeToJSON, isRegularEdge, regularEdge, } from "./types.js";
export class Graph {
    constructor(nodes, config = {}) {
        var _a, _b;
        this.nodes = {};
        this.edges = {};
        this.statelogClient = null;
        this.config = config;
        if (config.statelogHost) {
            this.statelogClient = new StatelogClient(config.statelogHost, (_b = (_a = config.debug) === null || _a === void 0 ? void 0 : _a.log) !== null && _b !== void 0 ? _b : false);
        }
    }
    node(id, func) {
        this.nodes[id] = func;
        if (!this.edges[id]) {
            this.edges[id] = [];
        }
    }
    edge(from, to) {
        if (!this.edges[from]) {
            this.edges[from] = [];
        }
        this.edges[from].push(regularEdge(to));
    }
    conditionalEdge(from, adjacentNodes, to) {
        if (!this.edges[from]) {
            this.edges[from] = [];
        }
        this.edges[from].push(conditionalEdge(to, adjacentNodes));
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
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            const jsonEdges = {};
            for (const from in this.edges) {
                jsonEdges[from] =
                    this.edges[from].map(edgeToJSON);
            }
            (_a = this.statelogClient) === null || _a === void 0 ? void 0 : _a.graph({
                nodes: Object.keys(this.nodes),
                edges: jsonEdges,
                startNode: startId,
            });
            const stack = [startId];
            let data = input;
            while (stack.length > 0) {
                const currentId = stack.pop();
                const nodeFunc = this.nodes[currentId];
                if (!nodeFunc) {
                    throw new GraphError(`Node function for ${currentId} not found.`);
                }
                if ((_b = this.config.hooks) === null || _b === void 0 ? void 0 : _b.beforeNode) {
                    this.debug(`Before hook for node: ${color.green(currentId)}`, data);
                    const startData = data;
                    data = yield this.config.hooks.beforeNode(currentId, data);
                    (_c = this.statelogClient) === null || _c === void 0 ? void 0 : _c.beforeHook(currentId, startData, data);
                }
                this.debug(`Executing node: ${color.green(currentId)}`, data);
                (_d = this.statelogClient) === null || _d === void 0 ? void 0 : _d.enterNode(currentId, data);
                data = yield this.runAndValidate(nodeFunc, currentId, data);
                (_e = this.statelogClient) === null || _e === void 0 ? void 0 : _e.exitNode(currentId, data);
                this.debug(`Completed node: ${color.green(currentId)}`, data);
                if ((_f = this.config.hooks) === null || _f === void 0 ? void 0 : _f.afterNode) {
                    this.debug(`After hook for node: ${color.green(currentId)}`, data);
                    const startData = data;
                    data = yield this.config.hooks.afterNode(currentId, data);
                    (_g = this.statelogClient) === null || _g === void 0 ? void 0 : _g.afterHook(currentId, startData, data);
                }
                const edges = this.edges[currentId] || [];
                for (const edge of edges) {
                    if (isRegularEdge(edge)) {
                        stack.push(edge.to);
                        (_h = this.statelogClient) === null || _h === void 0 ? void 0 : _h.followEdge(currentId, edge.to, false, data);
                        this.debug(`Following regular edge to: ${color.green(edge.to)}`);
                    }
                    else {
                        const nextId = yield edge.condition(data);
                        (_j = this.statelogClient) === null || _j === void 0 ? void 0 : _j.followEdge(currentId, nextId, true, data);
                        this.debug(`Following conditional edge to: ${color.green(nextId)}`, data);
                        stack.push(nextId);
                    }
                }
            }
            return data;
        });
    }
    runAndValidate(nodeFunc, currentId, _data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            let data = yield nodeFunc(_data);
            if ((_a = this.config.validation) === null || _a === void 0 ? void 0 : _a.func) {
                let retries = 0;
                const maxRetries = (_b = this.config.validation.maxRetries) !== null && _b !== void 0 ? _b : 0;
                let isValid = this.config.validation.func(data);
                while (!isValid) {
                    if (retries >= maxRetries) {
                        throw new GraphError(`Validation failed for node ${currentId} after ${maxRetries} retries.`);
                    }
                    this.debug(`Validation failed for node ${color.green(currentId)}, retrying... (${retries + 1}/${maxRetries})`, data);
                    data = yield nodeFunc(data);
                    isValid = this.config.validation.func(data);
                    retries++;
                }
            }
            return data;
        });
    }
    prettyPrint() {
        for (const from in this.edges) {
            for (const to of this.edges[from]) {
                console.log(`${from} -> ${this.prettyPrintEdge(to)}`);
            }
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
            for (const to of this.edges[from]) {
                if (isRegularEdge(to)) {
                    mermaid += `  ${from} --> ${to.to}\n`;
                }
                else {
                    to.adjacentNodes.forEach((adjNode) => {
                        mermaid += `  ${from} --> ${adjNode}\n`;
                    });
                }
            }
        }
        return mermaid;
    }
}
