#!/usr/bin/env bash
# Quatrain Core — Tycho Knowledge Package Post-Install Hook
# Integrates Quatrain Core OKF v0.1 knowledge base into AI agent configurations
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OKF_SOURCE="$REPO_ROOT/okf"

echo "🧠 [Quatrain Core] Tycho Knowledge Package Post-Install"
echo "   Source OKF: $OKF_SOURCE"

if [[ ! -d "$OKF_SOURCE" ]]; then
    echo "❌ Error: OKF directory not found at $OKF_SOURCE"
    exit 1
fi

LINKED=0

# 1. Integrate into ~/.tycho/knowledge/agents-okf if installed
TYCHO_AGENTS_OKF="$HOME/.tycho/knowledge/agents-okf"
if [[ -d "$TYCHO_AGENTS_OKF/content" ]]; then
    TARGET="$TYCHO_AGENTS_OKF/content/quatrain-core"
    rm -rf "$TARGET"
    ln -s "$OKF_SOURCE" "$TARGET"
    echo "✅ Linked into Tycho AGENTS.okf: $TARGET"
    LINKED=1

    if command -v bun &>/dev/null && [[ -f "$TYCHO_AGENTS_OKF/package.json" ]]; then
        echo "🔨 Refreshing AGENTS.okf routers..."
        (cd "$TYCHO_AGENTS_OKF" && bun run build && bun run sync:local 2>/dev/null || true)
    fi
fi

# 2. Check for local AGENTS.okf repository in standard workspace locations
LOCAL_CANDIDATES=(
    "$HOME/CODE/CRAPOUGNAX/AGENTS.okf"
    "$HOME/CODE/AGENTS.okf"
    "$HOME/projects/AGENTS.okf"
)

for candidate in "${LOCAL_CANDIDATES[@]}"; do
    if [[ -d "$candidate/content" ]]; then
        TARGET="$candidate/content/quatrain-core"
        if [[ ! -e "$TARGET" ]]; then
            ln -s "$OKF_SOURCE" "$TARGET"
            echo "✅ Linked into local AGENTS.okf repo: $TARGET"
            LINKED=1

            if command -v bun &>/dev/null && [[ -f "$candidate/package.json" ]]; then
                echo "🔨 Refreshing local AGENTS.okf routers..."
                (cd "$candidate" && bun run build && bun run sync:local 2>/dev/null || true)
            fi
        else
            echo "ℹ️  Target already exists: $TARGET"
            LINKED=1
        fi
    fi
done

if [[ $LINKED -eq 0 ]]; then
    echo "ℹ️  No automatic AGENTS.okf directory detected."
    echo "   You can manually link $OKF_SOURCE to your agent knowledge base:"
    echo "   ln -s $OKF_SOURCE /path/to/AGENTS.okf/content/quatrain-core"
fi

echo ""
echo "🎉 Quatrain Core OKF knowledge package configured successfully!"
