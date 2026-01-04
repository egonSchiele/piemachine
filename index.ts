import { goToNode, Graph } from "./lib/graph.js";
import { GraphConfig } from "./lib/types.js";
// The state type for our graph
type State = {
  count: number;
  log: string[];
};

// enable debug logging
const graphConfig: GraphConfig<State> = {
  debug: {
    log: true,
    logData: true,
  },
  validation: {
    func: async (data: State) => data.count >= 0,
    maxRetries: 3,
  },
};

// Define the names of the nodes in the graph
// Useful for type safety
const nodes = ["start", "increment", "finish"] as const;
type Node = (typeof nodes)[number];

// Create a new graph
const graph = new Graph<State, Node>(nodes, graphConfig);

// Add some nodes! Each node is an async function that takes the current state and returns a new state.
graph.node("start", async (data) => {
  return {
    ...data,
    log: [...data.log, "Starting computation"],
  };
});

graph.node("increment", async (data) => {
  const newCount = data.count + 1;
  const newData = {
    ...data,
    count: newCount,
    log: [...data.log, `Incremented count to ${newCount}`],
  };

  // Nodes can return GoToNode to jump to a specific node next
  if (newCount < 2) {
    return goToNode("increment", newData);
  }
  return goToNode("finish", newData);
});

graph.node("finish", async (data) => data);

graph.conditionalEdge("increment", ["finish", "increment"]);

// Define the edges between the nodes
graph.edge("start", "increment");
/* graph.conditionalEdge("increment", ["finish", "increment"], async (data) => {
  if (data.count < 2) {
    return "increment";
  } else {
    return "finish";
  }
}); */

async function main() {
  // Run the graph starting from the "start" node with an initial state
  const initialState: State = { count: 0, log: [] };
  const finalState = await graph.run("start", initialState);
  console.log(finalState);
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
