import { nanoid } from "nanoid";
export class StatelogClient {
    constructor(host, debug = false) {
        this.host = host;
        this.debug = debug;
        this.tid = nanoid();
        if (this.debug)
            console.log(`Statelog client initialized with host: ${host} and TID: ${this.tid}`);
    }
    logDebug(message, data) {
        this.post({
            type: "debug",
            message: message,
            data,
        });
    }
    logGraph({ nodes, edges, startNode, }) {
        this.post({
            type: "graph",
            data: {
                nodes,
                edges,
                startNode,
            },
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
            body: JSON.stringify(Object.assign(Object.assign({ tid: this.tid }, body), { timeStamp: new Date().toISOString() })),
        }).catch((err) => {
            if (this.debug)
                console.error("Failed to send statelog:", err);
        });
    }
}
