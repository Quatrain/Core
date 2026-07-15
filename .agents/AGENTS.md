# AI Agent Personal Knowledge Base (Second Brain) Protocol

Any AI agent interacting with this workspace MUST adhere to the following rules to query, read, and write user knowledge.

## 1. Context and Directory Location
- The user's personal knowledge base is formatted according to the **OKF (Open Knowledge Format) v0.1** specification.
- **Root Directory:** `/Users/crapougnax/CODE/CRAPOUGNAX/second-brain-data/content/`
- **Asset Directory:** `/Users/crapougnax/CODE/CRAPOUGNAX/second-brain-documents/`

---

## 2. Navigating and Reading Knowledge (Progressive Disclosure)
- **Do NOT perform blind grep searches or wild filesystem listings first.** 
- **Start at the Index:** To understand the structure or locate documents, start by reading the root index file:
  `file:///Users/crapougnax/CODE/CRAPOUGNAX/second-brain-data/content/index.md`
- **Follow Markdown Links:** Read the directory links (e.g. `* [technology](technology/)`) to navigate to subcategory indices like:
  - `file:///Users/crapougnax/CODE/CRAPOUGNAX/second-brain-data/content/technology/index.md`
  - `file:///Users/crapougnax/CODE/CRAPOUGNAX/second-brain-data/content/technology/ai/index.md`
- **Locate Concepts:** Category folders contain lists of matching concept documents (e.g. `okf-the-markdown-spec-for-humans-and-ai-agents.md` under `technology/ai/documentation-standards/`).
- **Load Referenced Documents:** If a loaded document contains standard Markdown cross-links (e.g. `[OKF Spec](/technology/ai/documentation-standards/okf-the-markdown-spec-for-humans-and-ai-agents.md)`), you must proactively load the target path to gather complete context.

---

## 3. Creating and Modifying Knowledge
When creating or updating concept documents, you MUST strictly conform to the OKF specification rules:
- **Semantic Names:** Use lowercase slugified titles for filenames (e.g. `my-new-concept.md`), never random UUIDs.
- **Flat YAML Frontmatter:** Place a flat YAML header bounded by `---` at the top of the file. Do not nest keys.
- **No Empty/Null Fields:** Exclude any fields that are null, undefined, or empty strings (`""`).
- **Mandatory Fields:**
  - `type`: Human-friendly singular lowercase word representing the concept kind (e.g. `specification`, `guide`, `screenshot`, `recipe`, `note`).
  - `title`: Describing human title.
  - `description`: 1-2 sentence description.
  - `tags`: Lowercase array of tag strings.
  - `timestamp`: Creation ISO timestamp.
- **Markdown Body:** Put all rich text content in the body below the YAML block.
