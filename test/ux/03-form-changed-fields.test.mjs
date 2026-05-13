// UX scenario: Form editor that submits only changed fields.
// User opens a profile-edit form, changes 2 fields out of 20, hits Save.
// We want to PATCH instead of PUT — saves bandwidth, makes audit logs
// readable, avoids overwriting concurrent server-side changes.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { diff, equals } from "../../dist/index.js";

const initialProfile = {
    name: "Alice",
    email: "alice@example.com",
    bio: "Engineer",
    company: "Acme",
    role: "Senior",
    avatar: "/a.png",
    location: "Berlin",
    website: "https://alice.dev",
    twitter: "@alice",
    linkedin: "/in/alice",
    timezone: "CET",
    language: "en",
    notifications: { email: true, push: false, sms: false },
    privacy: { profile: "public", email: "private" },
};

test("form-changed-fields: detects exactly the edited fields", async () => {
    // User changes only `role` and `notifications.push`:
    const edited = JSON.parse(JSON.stringify(initialProfile));
    edited.role = "Principal";
    edited.notifications.push = true;

    const patch = await diff(JSON.stringify(initialProfile), JSON.stringify(edited));

    assert.equal(patch.entries.length, 2, "exactly two leaves changed");
    const paths = patch.entries.map((e) => e.path).sort();
    assert.deepEqual(paths, ["/notifications/push", "/role"]);
});

test("form-changed-fields: unchanged form returns no entries (no save needed)", async () => {
    const unchanged = JSON.parse(JSON.stringify(initialProfile));
    assert.equal(await equals(JSON.stringify(initialProfile), JSON.stringify(unchanged)), true);
});

test("form-changed-fields: ignore ephemeral UI fields (focused, dirty flags)", async () => {
    // The form component decorates state with UI-only fields. We should
    // not send those to the server.
    const before = { ...initialProfile, _ui: { dirty: false, focused: null } };
    const after  = { ...initialProfile, name: "Alicia", _ui: { dirty: true, focused: "name" } };

    const patch = await diff(JSON.stringify(before), JSON.stringify(after), {
        ignore: ["/_ui"],
    });
    assert.equal(patch.entries.length, 1);
    assert.equal(patch.entries[0].path, "/name");
    assert.equal(patch.entries[0].rightValue, "Alicia");
});
