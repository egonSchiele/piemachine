# graph

A general-purpose library for defining and running graphs. Can be used to build agents but is also broadly useful.

## Quickstart

```typescript

import { Graph } from "./lib/graph.js";

// The state type for our graph
type State = {
  count: number;
  log: string[];
};

// enable debug logging
const graphConfig = {
  debug: {
    log: true,
    logData: true,
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
  return {
    ...data,
    count: data.count + 1,
    log: [...data.log, `Incremented count to ${data.count + 1}`],
  };
});

graph.node("finish", async (data) => data);

// Define the edges between the nodes
graph.edge("start", "increment");
graph.conditionalEdge("increment", ["finish", "increment"], async (data) => {
  if (data.count < 2) {
    return "increment";
  } else {
    return "finish";
  }
});

async function main() {
  // Run the graph starting from the "start" node with an initial state
  const initialState: State = { count: 0, log: [] };
  const finalState = await graph.run("start", initialState);
  console.log(finalState);
}

main();

```


Output:

```
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
```



Some options to visualize the graph:

```typescript
graph.prettyPrint();
/* Prints:
start -> increment
increment -> finish | increment
*/

console.log(graph.toMermaid());
/* Prints:
graph TD
  start --> increment
  increment --> finish
  increment --> increment
*/
```

## More about routing

There are three ways a node can route to another node. One is to specify a single edge to the next node:

```typescript
graph.edge("start", "increment");
```

Alternatively, a node can conditionally route to multiple other nodes. It can do so by returning an instance of `GoToNode`, where the first parameter is the name of the node it wants to route to, and the second parameter is the data it is sending to that node.

```typescript
graph.node("increment", async (data) => {
  const newCount = data.count + 1;
  const newData = {
    ...data,
    count: newCount,
    log: [...data.log, `Incremented count to ${newCount}`],
  };

  // Nodes can return GoToNode to jump to a specific node next
  if (newCount < 2) {
    // or new GoToNode("increment", newData);
    return goToNode("increment", newData);
  }
  return goToNode("finish", newData);
});

```
If you go with this approach, you also need to specify all the possible nodes that the node could route to.

```typescript
graph.conditionalEdge("increment", ["finish", "increment"]);
```

Finally, a node can conditionally route to multiple other nodes by having a routing function in the call to `conditionalEdge`.

```typescript
graph.conditionalEdge("increment", ["finish", "increment"], async (data) => {
  if (data.count < 2) {
    return "increment";
  } else {
    return "finish";
  }
});
```

Note that if you want a node to route to multiple other nodes, you need to do so conditionally. You can't have a node route to multiple other nodes in parallel:

```typescript
// This is not allowed
graph.edge("start", ["increment", "finish"]);

// This is also not allowed
graph.edge("start", "increment");
graph.edge("start", "finish");
```

