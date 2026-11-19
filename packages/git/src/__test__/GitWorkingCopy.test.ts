import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { GitCommandError, GitWorkingCopy } from "../GitWorkingCopy";

const AUTHOR = { name: "Ada", email: "ada@example.org" };

/** Runs git in a directory of the test, with a fixed identity. */
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=Seed", "-c", "user.email=seed@example.org", ...args], { cwd, encoding: "utf8" });
}

describe("GitWorkingCopy", () => {
  let root: string;
  let remote: string;
  let remoteUrl: string;

  /** Working copy of the test remote; the `file` transport stands for the network. */
  const workingCopy = (name: string, options: { branch?: string; token?: string } = {}) =>
    new GitWorkingCopy({ path: path.join(root, name), remote: remoteUrl, protocols: ["file"], author: AUTHOR, ...options });

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "quatrain-git-"));
    remote = path.join(root, "remote.git");
    fs.mkdirSync(remote);
    git(remote, "init", "--quiet", "--bare", "--initial-branch=main");
    remoteUrl = `file://${remote}`;
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  /** Puts a first commit on the remote, from a throwaway clone. */
  function seedRemote(files: Record<string, string>): void {
    const seed = path.join(root, "seed");
    git(root, "clone", "--quiet", remote, seed);
    git(seed, "checkout", "--quiet", "-B", "main");
    for (const [name, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(seed, name)), { recursive: true });
      fs.writeFileSync(path.join(seed, name), content);
    }
    git(seed, "add", "--all");
    git(seed, "commit", "--quiet", "-m", "seed");
    git(seed, "push", "--quiet", "origin", "main");
    fs.rmSync(seed, { recursive: true, force: true });
  }

  it("prepares a working copy from its remote and reports a clean state", async () => {
    seedRemote({ "content/guides/start.md": "# Start\n" });
    const copy = workingCopy("copy");
    await copy.prepare();

    expect(fs.readFileSync(path.join(copy.path, "content/guides/start.md"), "utf8")).toBe("# Start\n");
    const status = await copy.status();
    expect(status).toMatchObject({ branch: "main", clean: true, changes: [], ahead: 0 });
    expect(status.lastCommit?.subject).toBe("seed");
    expect(status.lastCommit?.hash).toMatch(/^[0-9a-f]{7,}$/);
  });

  it("commits the given paths only, then pushes", async () => {
    seedRemote({ "README.md": "seed\n" });
    const copy = workingCopy("copy");
    await copy.prepare();
    fs.writeFileSync(path.join(copy.path, "one.md"), "one\n");
    fs.writeFileSync(path.join(copy.path, "two.md"), "two\n");

    expect(await copy.commit("feat: add one", ["one.md"])).toBe(true);
    let status = await copy.status();
    expect(status.changes).toEqual(["two.md"]);
    expect(status.ahead).toBe(1);
    expect(status.lastCommit?.subject).toBe("feat: add one");

    await copy.push();
    status = await copy.status();
    expect(status.ahead).toBe(0);
    expect(git(remote, "log", "-1", "--pretty=format:%an <%ae> %s", "main")).toBe("Ada <ada@example.org> feat: add one");
  });

  it("tells when there is nothing to commit", async () => {
    seedRemote({ "README.md": "seed\n" });
    const copy = workingCopy("copy");
    await copy.prepare();
    expect(await copy.commit("chore: nothing")).toBe(false);
    expect(await copy.commit("chore: nothing", ["README.md"])).toBe(false);
  });

  it("starts from an empty remote, and its first push creates the branch", async () => {
    const copy = workingCopy("copy");
    await copy.prepare();
    expect(await copy.status()).toEqual({ branch: "main", clean: true, changes: [] });

    fs.writeFileSync(path.join(copy.path, "index.md"), "# Home\n");
    expect(await copy.commit("feat: first document")).toBe(true);
    expect((await copy.status()).ahead).toBe(1);
    await copy.push();
    expect(git(remote, "log", "-1", "--pretty=format:%s", "main")).toBe("feat: first document");
  });

  it("brings in the commits pushed by another working copy", async () => {
    seedRemote({ "README.md": "seed\n" });
    const first = workingCopy("first");
    const second = workingCopy("second");
    await first.prepare();
    await second.prepare();

    fs.writeFileSync(path.join(first.path, "note.md"), "note\n");
    await first.commit("feat: note");
    await first.push();

    await second.refresh();
    expect(fs.existsSync(path.join(second.path, "note.md"))).toBe(true);
    await second.prepare();
    expect((await second.status()).lastCommit?.subject).toBe("feat: note");
  });

  it("refuses to rewrite history when both sides moved", async () => {
    seedRemote({ "README.md": "seed\n" });
    const first = workingCopy("first");
    const second = workingCopy("second");
    await first.prepare();
    await second.prepare();
    fs.writeFileSync(path.join(first.path, "a.md"), "a\n");
    await first.commit("feat: a");
    await first.push();
    fs.writeFileSync(path.join(second.path, "b.md"), "b\n");
    await second.commit("feat: b");

    await expect(second.push()).rejects.toBeInstanceOf(GitCommandError);
    await expect(second.refresh()).rejects.toBeInstanceOf(GitCommandError);
    expect((await second.status()).lastCommit?.subject).toBe("feat: b");
  });

  it("discards a refused commit and applies the change again on the state of the remote", async () => {
    seedRemote({ "README.md": "seed\n", ".gitignore": "cache/\n" });
    const first = workingCopy("first");
    const second = workingCopy("second");
    await first.prepare();
    await second.prepare();
    fs.writeFileSync(path.join(first.path, "a.md"), "a\n");
    await first.commit("feat: a");
    await first.push();

    fs.writeFileSync(path.join(second.path, "b.md"), "b\n");
    fs.writeFileSync(path.join(second.path, "README.md"), "changed\n");
    await second.commit("feat: b", ["b.md"]);
    fs.writeFileSync(path.join(second.path, "stray.md"), "stray\n");
    fs.mkdirSync(path.join(second.path, "cache"));
    fs.writeFileSync(path.join(second.path, "cache", "kept.bin"), "kept\n");
    await expect(second.push()).rejects.toBeInstanceOf(GitCommandError);

    await second.discard();
    let status = await second.status();
    expect(status).toMatchObject({ clean: true, changes: [], ahead: 0 });
    expect(status.lastCommit?.subject).toBe("feat: a");
    expect(fs.existsSync(path.join(second.path, "b.md"))).toBe(false);
    expect(fs.existsSync(path.join(second.path, "stray.md"))).toBe(false);
    expect(fs.readFileSync(path.join(second.path, "README.md"), "utf8")).toBe("seed\n");
    expect(fs.existsSync(path.join(second.path, "cache", "kept.bin"))).toBe(true);

    fs.writeFileSync(path.join(second.path, "b.md"), "b\n");
    await second.commit("feat: b", ["b.md"]);
    await second.push();
    status = await second.status();
    expect(status.ahead).toBe(0);
    expect(git(remote, "log", "--pretty=format:%s", "main").split("\n")).toEqual(["feat: b", "feat: a", "seed"]);
  });

  it("discards back to an empty branch when the remote has none yet", async () => {
    const copy = workingCopy("copy");
    await copy.prepare();
    fs.writeFileSync(path.join(copy.path, "index.md"), "# Home\n");
    await copy.commit("feat: first document");
    fs.writeFileSync(path.join(copy.path, "draft.md"), "draft\n");

    await copy.discard();
    expect(await copy.status()).toEqual({ branch: "main", clean: true, changes: [] });
    expect(fs.readdirSync(copy.path)).toEqual([".git"]);
    expect(git(remote, "branch", "--list")).toBe("");
  });

  it("discards only the changes not committed when there is no remote", async () => {
    const copy = new GitWorkingCopy({ path: path.join(root, "local"), author: AUTHOR });
    await copy.prepare();
    fs.writeFileSync(path.join(copy.path, "a.md"), "a\n");
    await copy.commit("feat: a");
    fs.writeFileSync(path.join(copy.path, "a.md"), "changed\n");
    fs.writeFileSync(path.join(copy.path, "b.md"), "b\n");

    await copy.discard();
    const status = await copy.status();
    expect(status.clean).toBe(true);
    expect(status.lastCommit?.subject).toBe("feat: a");
    expect(fs.readFileSync(path.join(copy.path, "a.md"), "utf8")).toBe("a\n");
    expect(fs.existsSync(path.join(copy.path, "b.md"))).toBe(false);
  });

  it("refuses to commit a path outside the working copy or inside its git directory", async () => {
    const copy = workingCopy("copy");
    await copy.prepare();
    for (const entry of ["../outside.md", "/etc/hosts", ".git/config", "", "."]) {
      await expect(copy.commit("feat: escape", [entry])).rejects.toThrow(/path to commit/);
    }
    await expect(copy.commit("  ")).rejects.toThrow(/message/);
  });

  it("commits a file whose name looks like an option or a command", async () => {
    const copy = workingCopy("copy");
    await copy.prepare();
    const marker = path.join(copy.path, "marker");
    const name = "--exec=touch marker; $(touch marker).md";
    fs.writeFileSync(path.join(copy.path, name), "x\n");
    expect(await copy.commit('feat: "$(touch marker)" `touch marker`', [name])).toBe(true);
    expect(fs.existsSync(marker)).toBe(false);
    expect((await copy.status()).clean).toBe(true);
  });

  it("checks out a symbolic link of the repository as a plain file", async () => {
    const seed = path.join(root, "seed");
    git(root, "clone", "--quiet", remote, seed);
    git(seed, "checkout", "--quiet", "-B", "main");
    fs.writeFileSync(path.join(root, "secret.txt"), "outside\n");
    fs.symlinkSync(path.join(root, "secret.txt"), path.join(seed, "leak.md"));
    git(seed, "add", "--all");
    git(seed, "commit", "--quiet", "-m", "seed");
    git(seed, "push", "--quiet", "origin", "main");

    const copy = workingCopy("copy");
    await copy.prepare();
    const leak = path.join(copy.path, "leak.md");
    expect(fs.lstatSync(leak).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(leak, "utf8")).not.toContain("outside");
  });

  it("does not run the hooks of the working copy", async () => {
    const copy = workingCopy("copy");
    await copy.prepare();
    const marker = path.join(root, "hook-ran");
    const hook = path.join(copy.path, ".git", "hooks", "pre-commit");
    fs.mkdirSync(path.dirname(hook), { recursive: true });
    fs.writeFileSync(hook, `#!/bin/sh\ntouch ${marker}\n`, { mode: 0o755 });
    fs.writeFileSync(path.join(copy.path, "a.md"), "a\n");
    await copy.commit("feat: a");
    expect(fs.existsSync(marker)).toBe(false);
  });

  it("accepts HTTPS remotes only unless told otherwise, and no credential in the address", () => {
    const at = path.join(root, "copy");
    expect(() => new GitWorkingCopy({ path: at, remote: remoteUrl })).toThrow(/https/);
    expect(() => new GitWorkingCopy({ path: at, remote: "ssh://git@example.org/acme/kb.git" })).toThrow(/https/);
    expect(() => new GitWorkingCopy({ path: at, remote: "ext::sh -c touch%20x" })).toThrow(GitCommandError);
    expect(() => new GitWorkingCopy({ path: at, remote: "https://user:pass@example.org/acme/kb.git" })).toThrow(/credential/);
    expect(() => new GitWorkingCopy({ path: at, remote: "https://example.org/acme/kb.git" })).not.toThrow();
    expect(() => new GitWorkingCopy({ path: at, branch: "--upload-pack=x" })).toThrow(/branch/);
  });

  it("keeps the token out of the working copy and of error messages", async () => {
    const token = "tok_3f9a1c77d2";
    const copy = new GitWorkingCopy({ path: path.join(root, "copy"), remote: "https://127.0.0.1:1/acme/kb.git", token, timeoutMs: 20_000 });
    let message = "";
    try {
      await copy.prepare();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/Fetching from the remote/);
    expect(message).not.toContain(token);
    expect(message).not.toContain(Buffer.from(`x-access-token:${token}`).toString("base64"));
    const config = fs.readFileSync(path.join(copy.path, ".git", "config"), "utf8");
    expect(config).not.toContain(token);
    expect(config).toContain("https://127.0.0.1:1/acme/kb.git");
  });

  it("works without a remote, and then cannot push", async () => {
    const copy = new GitWorkingCopy({ path: path.join(root, "local"), author: AUTHOR });
    await copy.prepare();
    fs.writeFileSync(path.join(copy.path, "a.md"), "a\n");
    expect(await copy.commit("feat: a")).toBe(true);
    const status = await copy.status();
    expect(status.lastCommit?.subject).toBe("feat: a");
    expect(status.ahead).toBeUndefined();
    await expect(copy.push()).rejects.toThrow(/no remote/);
  });

  it("runs concurrent operations one at a time", async () => {
    const copy = workingCopy("copy");
    await copy.prepare();
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((index) => {
        fs.writeFileSync(path.join(copy.path, `${index}.md`), `${index}\n`);
        return copy.commit(`feat: ${index}`, [`${index}.md`]);
      })
    );
    expect(results).toEqual([true, true, true, true, true]);
    expect((await copy.status()).clean).toBe(true);
  });
});
