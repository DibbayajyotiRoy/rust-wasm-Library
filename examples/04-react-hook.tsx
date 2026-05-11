// React hook — keep a diff view in sync with two pieces of state.
// Install: npm install diffcore react
import { useDiff } from "diffcore/react";
import { DiffOp } from "diffcore";

export function ChangeReview({ original, draft }: { original: unknown; draft: unknown }) {
    const { result, loading, error } = useDiff(original, draft);

    if (loading) return <p>Computing diff…</p>;
    if (error) return <p style={{ color: "red" }}>{error.message}</p>;
    if (!result || result.entries.length === 0) return <p>No changes.</p>;

    return (
        <ul>
            {result.entries.map((e, i) => (
                <li key={i}>
                    <code>{DiffOp[e.op]}</code> <strong>{e.path}</strong>{" "}
                    <span>{JSON.stringify(e.leftValue)} → {JSON.stringify(e.rightValue)}</span>
                </li>
            ))}
        </ul>
    );
}
