import process from "process";
const config = {
    statelogHost: process.env.STATELOG_HOST || undefined
};
console.log("Config loaded:", config);
export default config;
