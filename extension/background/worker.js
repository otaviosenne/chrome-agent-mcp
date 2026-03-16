import { initState, restorePromise } from "./commands.js";
import { registerEventListeners } from "./events.js";

registerEventListeners();
initState();
