export declare class StatelogClient {
    private host;
    private tid;
    constructor(host: string | undefined);
    log(data: Record<string, any>): void;
}
export declare function getStatelogClient(): StatelogClient;
