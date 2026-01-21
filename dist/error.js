class PieMachineError extends Error {
    constructor(message) {
        super(message);
        this.name = "PieMachineError";
    }
}
export { PieMachineError };
