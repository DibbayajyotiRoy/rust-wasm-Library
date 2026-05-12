// Git-style 3-way merge: apply both branches' edits to `base`, report conflicts.
import { merge3 } from "diffcore/state";

const base    = { name: "Alice", role: "user",  posts: 0 };
const branchA = { name: "Alice", role: "admin", posts: 0 };   // edits /role
const branchB = { name: "Alice", role: "user",  posts: 7 };   // edits /posts

const merged = await merge3(base, branchA, branchB);
console.log(merged.value);
//   { name: "Alice", role: "admin", posts: 7 }
console.log("conflicts:", merged.conflicts.length);
//   0

// Conflicting edits: choose a resolution strategy.
const conflicting = await merge3(
    { x: 1 },
    { x: 2 },          // branch A
    { x: 3 },          // branch B
    { strategy: "prefer-b" }
);
console.log(conflicting.value);             //  { x: 3 }
console.log(conflicting.conflicts[0].path); //  /x
