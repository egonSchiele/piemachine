class PieMachineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PieMachineError";
  }
}

export { PieMachineError };
