/**
 * React hook subexport: `import { useDiff } from 'diffcore/react'`
 *
 * Returns the resolved diff between two JSON inputs and keeps it in sync as
 * the inputs change. WASM is loaded lazily and cached across hook instances.
 */

import { useEffect, useRef, useState } from "react";
import type { DiffCoreConfig, DiffResult } from "./types.js";
import { diff } from "./index.js";
import { DiffCoreError } from "./errors.js";

export interface UseDiffState {
    /** Latest computed diff, or `null` while loading or on error. */
    result: DiffResult | null;
    /** True while the diff is being computed. */
    loading: boolean;
    /** Error from the last computation, or `null`. */
    error: DiffCoreError | null;
}

export interface UseDiffOptions extends DiffCoreConfig {
    /**
     * Skip the diff entirely if either input is null/undefined. Default: true.
     * Useful while async data is still loading.
     */
    skipWhenMissing?: boolean;
}

/**
 * Compute a JSON diff inside a React component.
 *
 * @example
 * ```tsx
 * const { result, loading } = useDiff(prev, next);
 * if (loading) return <Spinner />;
 * return <DiffView entries={result?.entries ?? []} />;
 * ```
 */
export function useDiff(
    left: string | Uint8Array | object | null | undefined,
    right: string | Uint8Array | object | null | undefined,
    options: UseDiffOptions = {}
): UseDiffState {
    const [state, setState] = useState<UseDiffState>({
        result: null,
        loading: false,
        error: null,
    });
    const runIdRef = useRef(0);
    const skipWhenMissing = options.skipWhenMissing ?? true;

    useEffect(() => {
        if (skipWhenMissing && (left == null || right == null)) {
            setState({ result: null, loading: false, error: null });
            return;
        }

        const runId = ++runIdRef.current;
        setState((s: UseDiffState) => ({ ...s, loading: true, error: null }));

        const toBytes = (v: unknown): string | Uint8Array => {
            if (typeof v === "string") return v;
            if (v instanceof Uint8Array) return v;
            return JSON.stringify(v);
        };

        diff(toBytes(left), toBytes(right), options)
            .then((result) => {
                if (runId !== runIdRef.current) return;
                setState({ result, loading: false, error: null });
            })
            .catch((err: unknown) => {
                if (runId !== runIdRef.current) return;
                const wrapped =
                    err instanceof DiffCoreError
                        ? err
                        : new DiffCoreError(err instanceof Error ? err.message : String(err), err);
                setState({ result: null, loading: false, error: wrapped });
            });

        return () => {
            runIdRef.current++;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [left, right, skipWhenMissing]);

    return state;
}
