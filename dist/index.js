var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Graph } from "./lib/graph.js";
import "./lib/envFile.js";
// enable debug logging
const graphConfig = {
    debug: {
        log: true,
        logData: true,
    },
};
// Define the names of the nodes in the graph
// Useful for type safety
const nodes = ["start", "increment", "finish"];
// Create a new graph
const graph = new Graph(nodes, graphConfig);
// Add some nodes! Each node is an async function that takes the current state and returns a new state.
graph.node("start", (data) => __awaiter(void 0, void 0, void 0, function* () {
    return Object.assign(Object.assign({}, data), { log: [...data.log, "Starting computation"] });
}));
graph.node("increment", (data) => __awaiter(void 0, void 0, void 0, function* () {
    return Object.assign(Object.assign({}, data), { count: data.count + 1, log: [...data.log, `Incremented count to ${data.count + 1}`] });
}));
graph.node("finish", (data) => __awaiter(void 0, void 0, void 0, function* () { return data; }));
// Define the edges between the nodes
graph.edge("start", "increment");
graph.conditionalEdge("increment", ["finish", "increment"], (data) => __awaiter(void 0, void 0, void 0, function* () {
    if (data.count < 2) {
        return "increment";
    }
    else {
        return "finish";
    }
}));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // Run the graph starting from the "start" node with an initial state
        const initialState = { count: 0, log: [] };
        const finalState = yield graph.run("start", initialState);
        console.log(finalState);
    });
}
main();
/*
Output:

[DEBUG]: Executing node: start | Data: {"count":0,"log":[]}
[DEBUG]: Completed node: start | Data: {"count":0,"log":["Starting computation"]}
[DEBUG]: Following regular edge to: increment
[DEBUG]: Executing node: increment | Data: {"count":0,"log":["Starting computation"]}
[DEBUG]: Completed node: increment | Data: {"count":1,"log":["Starting computation","Incremented count to 1"]}
[DEBUG]: Following conditional edge to: increment | Data: {"count":1,"log":["Starting computation","Incremented count to 1"]}
[DEBUG]: Executing node: increment | Data: {"count":1,"log":["Starting computation","Incremented count to 1"]}
[DEBUG]: Completed node: increment | Data: {"count":2,"log":["Starting computation","Incremented count to 1","Incremented count to 2"]}
[DEBUG]: Following conditional edge to: finish | Data: {"count":2,"log":["Starting computation","Incremented count to 1","Incremented count to 2"]}
[DEBUG]: Executing node: finish | Data: {"count":2,"log":["Starting computation","Incremented count to 1","Incremented count to 2"]}
[DEBUG]: Completed node: finish | Data: {"count":2,"log":["Starting computation","Incremented count to 1","Incremented count to 2"]}
{
  count: 2,
  log: [
    'Starting computation',
    'Incremented count to 1',
    'Incremented count to 2'
  ]
}
*/
// Some options to visualize the graph:
//graph.prettyPrint();
/* Prints:
start -> increment
increment -> finish | increment
*/
//console.log(graph.toMermaid());
/* Prints:
graph TD
  start --> increment
  increment --> finish
  increment --> increment
*/
