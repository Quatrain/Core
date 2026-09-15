# Quatrain Core - Gemini Agent Guidelines & Instruction Pointer

> [!NOTE]
> **Updated:** May 23, 2026 | **Engine:** Gemini 3.5 Flash (High) | **License:** AGPL-v3

This document serves as the dedicated instruction and guidelines pointer specifically tailored for the Gemini AI Coding Agent.

When executing tasks or responding to requests in this repository, you MUST load and comply with the following instructions:

---

## 🧭 Guidelines & Instruction Paths

### 1. Building Applications with Quatrain
If the task is to construct or design application schemas, models, repositories, and business features **using** the Quatrain ecosystem, follow the guidelines in:
👉 [AGENTS.md (Application Development Guidelines)](./guidelines/AGENTS.md)

### 2. Modifying Quatrain Core Codebase
If the task requires editing, refactoring, fixing, or extending the packages, monorepo workspaces, containers, or CI/CD pipelines of the **Quatrain Core repository itself**, follow the strict guidelines in:
👉 [CONTRIBUTING_AGENTS.md (Monorepo Contributing Guidelines)](./guidelines/CONTRIBUTING_AGENTS.md)

### 3. GitFlow Lifecycle & Pull Requests
All contributions follow the GitFlow lifecycle defined in [AGENTS.okf](file:///Users/crapougnax/CODE/CRAPOUGNAX/AGENTS.okf/content/workflow/gitflow-protocol.md):
- Active integration branch: `develop`
- Branching: `feat/<issue-id>-<description>` or `fix/<issue-id>-<description>` strictly from `develop`
- Pull Requests: Target `--base develop` via `gh pr create`

---

## 👤 Personal Rules & Custom Settings

In addition to the framework-level guidelines, you MUST adhere to the user's personal coding preferences, custom shortcuts, and general development rules published in:
👉 [AGENTS.okf Knowledge Base](file:///Users/crapougnax/CODE/CRAPOUGNAX/AGENTS.okf/content/index.md) | [GitHub Repository](https://github.com/crapougnax/AGENTS.okf)
👉 [Gist: Personal Gemini Rules & Instructions](https://gist.github.com/crapougnax/47971b85aa73dd702f4372a89858111c)


---

## 🛑 Strict TypeScript & Code Quality Rules

- **No `as any` Type Bypasses**: Never use `as any`, `@ts-ignore`, `@ts-nocheck`, or type assertion shortcuts to silence TypeScript errors. Always construct fully compliant, strongly-typed objects that satisfy the target interfaces and schemas.

