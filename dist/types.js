export function regularEdge(to) {
    return { type: "regular", to };
}
export function conditionalEdge(condition, adjacentNodes) {
    return { type: "conditional", condition, adjacentNodes };
}
export function isRegularEdge(edge) {
    return edge.type === "regular";
}
export function isConditionalEdge(edge) {
    return edge.type === "conditional";
}
export function edgeToJSON(edge) {
    if (isRegularEdge(edge)) {
        return { type: "regular", to: edge.to };
    }
    else {
        return {
            type: "conditional",
            adjacentNodes: edge.adjacentNodes,
        };
    }
}
