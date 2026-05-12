// Bounded undo/redo stack that stores *patches*, not snapshots.
// Memory cost is O(changed-bytes), not O(state-size * history-depth).
import { createHistory } from "diffcore/state";

const history = createHistory(
    { count: 0, todos: [] },
    { maxSize: 50 }   // keep last 50 changes
);

await history.push({ count: 1, todos: [{ text: "buy milk" }] });
await history.push({ count: 2, todos: [{ text: "buy milk" }, { text: "call mom" }] });

console.log("current:", history.current);
//   { count: 2, todos: [{ text: "buy milk" }, { text: "call mom" }] }

history.undo();
console.log("after undo:", history.current);
//   { count: 1, todos: [{ text: "buy milk" }] }

history.redo();
console.log("after redo:", history.current);
//   { count: 2, todos: [{ text: "buy milk" }, { text: "call mom" }] }
