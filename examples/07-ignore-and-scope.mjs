// Filter the diff before it reaches your code:
//   - `ignore`: drop entries whose path matches one of these JSON Pointers
//   - `scope`:  keep only entries under this JSON Pointer subtree
import { diff } from "diffcore";

const before = {
    users: [{ id: 1, name: "Alice" }],
    products: [{ id: 1, title: "Book" }],
    _meta: { fetchedAt: 1730000000, requestId: "abc" },
};
const after = {
    users: [{ id: 1, name: "Alicia" }],
    products: [{ id: 1, title: "Book", price: 9.99 }],
    _meta: { fetchedAt: 1730005000, requestId: "xyz" },
};

// Drop noisy metadata:
const cleaned = await diff(JSON.stringify(before), JSON.stringify(after), {
    ignore: ["/_meta"],
});
console.log("ignore:", cleaned.entries.map((e) => e.path));
//   ["/users/0/name", "/products/0/price"]

// Only look under /users:
const usersOnly = await diff(JSON.stringify(before), JSON.stringify(after), {
    scope: "/users",
});
console.log("scope:", usersOnly.entries.map((e) => e.path));
//   ["/users/0/name"]
