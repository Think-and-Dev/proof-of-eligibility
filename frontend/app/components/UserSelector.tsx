"use client";

import { useVCAuth } from "../VCAuthProvider";

export function UserSelector() {
    const { selectedUserId, loading, selectUser, bearerDid } = useVCAuth();

    return (
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
                <label className="text-[11px] text-slate-400">Test User:</label>
                <select
                    value={selectedUserId || ""}
                    onChange={(e) => {
                        const userId = parseInt(e.target.value, 10);
                        if (userId >= 1 && userId <= 5) {
                            selectUser(userId);
                        }
                    }}
                    disabled={loading}
                    className="px-2 py-1 rounded border border-slate-700 bg-slate-900 text-slate-50 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <option value="">Select user</option>
                    {[1, 2, 3, 4, 5].map((num) => (
                        <option key={num} value={num}>
                            User {num}
                        </option>
                    ))}
                </select>
                {loading && (
                    <div className="h-3 w-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                )}
            </div>
            {bearerDid && bearerDid.uri && (
                <div className="flex items-center gap-2 px-2 py-1 rounded border border-slate-700 bg-slate-900/60">
                    <span className="text-[10px] text-slate-400">DID:</span>
                    <span className="font-mono text-[10px] text-slate-300">
                        {bearerDid.uri.length > 40
                            ? `${bearerDid.uri.slice(0, 20)}...${bearerDid.uri.slice(-20)}`
                            : bearerDid.uri
                        }
                    </span>
                </div>
            )}
        </div>
    );
}

