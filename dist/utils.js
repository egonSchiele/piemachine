export function runtime(callback) {
    if (performance && performance.now) {
        const start = performance.now();
        callback();
        const end = performance.now();
        return end - start;
    }
    else {
        callback();
        return null;
    }
}
