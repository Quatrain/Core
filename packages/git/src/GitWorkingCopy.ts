// packages/git/src/GitWorkingCopy.ts
/**
 * @quatrain/git - GitWorkingCopy
 * @description Local working copy of a remote repository, operated without a shell
 * @license AGPL-3.0-only
 */

import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";

/** Access token of a remote, or a function giving it when an operation needs it. */
export type GitTokenType = string | (() => string | undefined | Promise<string | undefined>);

/** Who signs the commits made in a working copy. */
export interface GitAuthorInterface {
  name: string;
  email: string;
}

/**
 * How a working copy is built.
 */
export interface GitWorkingCopyOptionsInterface {
  /** Directory of the working copy. Created when missing. */
  path: string;
  /** Address of the remote, without credential. Without it the working copy is local only. */
  remote?: string;
  /** Branch the working copy follows (default `main`). */
  branch?: string;
  /**
   * Access token of the remote. It is sent as an HTTP header, given to git through the
   * environment of its process and scoped to the remote: it is never written in the remote
   * address, in the configuration of the working copy nor on a command line.
   */
  token?: GitTokenType;
  /** Author of the commits (default: `GitWorkingCopy.DEFAULT_AUTHOR`). */
  author?: GitAuthorInterface;
  /** Transports git may use to reach the remote (default: `https` only). */
  protocols?: string[];
  /** Longest time one git command may take, in milliseconds (default 120 000). */
  timeoutMs?: number;
}

/** Last commit of a working copy. */
export interface GitCommitSummaryInterface {
  /** Abbreviated hash. */
  hash: string;
  subject: string;
  /** ISO 8601 date of the commit. */
  date: string;
}

/**
 * State of a working copy.
 */
export interface GitWorkingCopyStatusInterface {
  branch: string;
  /** Whether nothing is waiting to be committed. */
  clean: boolean;
  /** Paths with changes not committed yet, relative to the working copy. */
  changes: string[];
  /** Absent while the branch has no commit. */
  lastCommit?: GitCommitSummaryInterface;
  /** Commits not pushed yet; absent without a remote or before the first fetch. */
  ahead?: number;
}

/**
 * Raised when a git command fails. The message holds what git printed, without any token.
 */
export class GitCommandError extends Error {
  /**
   * @param action - What was attempted, in a few words.
   * @param detail - What git printed, already scrubbed.
   */
  constructor(
    public readonly action: string,
    detail: string
  ) {
    super(detail ? `${action}: ${detail}` : action);
    this.name = "GitCommandError";
  }
}

const BRANCH = /^(?!-)(?!.*\.\.)(?!.*\/\/)[A-Za-z0-9._\/-]{1,200}(?<![\/.])$/;
const PROTOCOL = /^[a-z][a-z0-9+.-]*$/;
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const MAX_ERROR_LENGTH = 600;

/**
 * Local working copy of a repository: prepare it from its remote, read its state, commit and
 * push. Git runs without a shell, so a file name or a message is never read as a command, and
 * ignores the configuration, the credential helpers and the hooks of the machine. Symbolic
 * links of the repository are checked out as plain files, so its content cannot point outside
 * the working copy. Operations on one instance run one at a time.
 */
export class GitWorkingCopy {
  /** Author of the commits when the options name none. */
  static DEFAULT_AUTHOR: GitAuthorInterface = { name: "Quatrain", email: "noreply@quatrain.invalid" };

  readonly path: string;
  readonly branch: string;
  readonly remote: string | undefined;

  protected readonly token: GitTokenType | undefined;
  protected readonly author: GitAuthorInterface;
  protected readonly protocols: string[];
  protected readonly timeoutMs: number;
  protected queue: Promise<unknown> = Promise.resolve();

  /**
   * @param options - Directory, remote, branch and credential of the working copy.
   * @throws GitCommandError when the branch, the remote or a protocol is malformed, or when the
   *    remote address carries a credential.
   */
  constructor(options: GitWorkingCopyOptionsInterface) {
    if (typeof options.path !== "string" || options.path === "") {
      throw new GitCommandError("A working copy needs a directory", "");
    }
    this.path = path.resolve(options.path);
    this.branch = options.branch ?? "main";
    if (!BRANCH.test(this.branch)) {
      throw new GitCommandError("The branch name is not valid", "");
    }
    this.protocols = options.protocols ?? ["https"];
    if (this.protocols.length === 0 || this.protocols.some((protocol) => !PROTOCOL.test(protocol))) {
      throw new GitCommandError("The list of protocols is not valid", "");
    }
    this.remote = options.remote === undefined ? undefined : this.checkRemote(options.remote);
    this.token = options.token;
    this.author = options.author ?? GitWorkingCopy.DEFAULT_AUTHOR;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Makes the working copy ready: creates it and fetches the branch on first use, brings it up
   * to date afterwards. A remote that has no such branch yet gives an empty working copy, whose
   * first push creates the branch.
   *
   * @throws GitCommandError when the remote cannot be reached, refuses the token, or when the
   *    local branch and the remote one have diverged.
   */
  prepare(): Promise<void> {
    return this.exclusive(async () => {
      await fs.mkdir(this.path, { recursive: true });
      if (!(await this.isRepository())) {
        await this.git("Creating the working copy", ["init", "--quiet"]);
        await this.git("Creating the working copy", ["symbolic-ref", "HEAD", `refs/heads/${this.branch}`]);
      }
      if (this.remote === undefined) {
        return;
      }
      await this.setRemote(this.remote);
      await this.fastForward();
    });
  }

  /**
   * Brings the working copy up to date with its remote, without rewriting local commits.
   *
   * @throws GitCommandError without a remote, when it cannot be reached, or when the local
   *    branch and the remote one have diverged.
   */
  refresh(): Promise<void> {
    return this.exclusive(async () => {
      this.requireRemote();
      await this.fastForward();
    });
  }

  /**
   * Reads the state of the working copy.
   *
   * @returns Its branch, what is waiting to be committed, and its last commit.
   */
  status(): Promise<GitWorkingCopyStatusInterface> {
    return this.exclusive(async () => {
      const porcelain = await this.git("Reading the state of the working copy", ["status", "--porcelain", "-z", "--untracked-files=all"]);
      const changes = porcelain
        .split("\0")
        .filter((entry) => entry.length > 3)
        .map((entry) => entry.slice(3));
      const status: GitWorkingCopyStatusInterface = { branch: this.branch, clean: changes.length === 0, changes };
      if (await this.hasCommit()) {
        const [hash, date, ...subject] = (await this.git("Reading the last commit", ["log", "-1", "--pretty=format:%h%x00%cI%x00%s"])).split("\0");
        status.lastCommit = { hash, date, subject: subject.join("\0") };
        if (this.remote !== undefined && (await this.hasRemoteBranch())) {
          const count = await this.git("Counting the commits to push", ["rev-list", "--count", `refs/remotes/origin/${this.branch}..HEAD`]);
          status.ahead = Number.parseInt(count.trim(), 10) || 0;
        } else if (this.remote !== undefined) {
          const count = await this.git("Counting the commits to push", ["rev-list", "--count", "HEAD"]);
          status.ahead = Number.parseInt(count.trim(), 10) || 0;
        }
      }
      return status;
    });
  }

  /**
   * Commits changes of the working copy.
   *
   * @param message - Commit message.
   * @param paths - Paths to commit, relative to the working copy; every change when omitted.
   * @param author - Author of this commit; the author of the working copy when omitted.
   * @returns Whether a commit was made: `false` when the paths hold no change.
   * @throws GitCommandError when the message is empty or a path leaves the working copy.
   */
  commit(message: string, paths: string[] = [], author?: GitAuthorInterface): Promise<boolean> {
    return this.exclusive(async () => {
      if (typeof message !== "string" || message.trim() === "") {
        throw new GitCommandError("A commit needs a message", "");
      }
      const targets = paths.map((entry) => this.checkPath(entry));
      if (targets.length > 0) {
        await this.git("Staging the changes", ["add", "--", ...targets]);
      } else {
        await this.git("Staging the changes", ["add", "--all"]);
      }
      const staged = await this.git("Reading the staged changes", ["diff", "--cached", "--name-only", "-z"]);
      if (staged === "") {
        return false;
      }
      const signer = author ?? this.author;
      await this.git("Committing", ["-c", `user.name=${signer.name}`, "-c", `user.email=${signer.email}`, "commit", "--quiet", "--no-verify", "-m", message]);
      return true;
    });
  }

  /**
   * Pushes the commits of the branch to the remote.
   *
   * @throws GitCommandError without a remote, when it refuses the push, or when it holds commits
   *    the working copy does not have: call `refresh()` first.
   */
  push(): Promise<void> {
    return this.exclusive(async () => {
      this.requireRemote();
      if (!(await this.hasCommit())) {
        return;
      }
      await this.git("Pushing to the remote", ["push", "--quiet", "origin", `HEAD:refs/heads/${this.branch}`], true);
      await this.git("Recording the pushed state", ["update-ref", `refs/remotes/origin/${this.branch}`, "HEAD"]);
    });
  }

  /**
   * Runs the operations of this working copy one after the other.
   */
  protected exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.catch(() => undefined);
    return result;
  }

  protected async fastForward(): Promise<void> {
    const hadCommit = await this.hasCommit();
    try {
      await this.git(
        "Fetching from the remote",
        ["fetch", "--quiet", "--no-tags", "origin", `+refs/heads/${this.branch}:refs/remotes/origin/${this.branch}`],
        true
      );
    } catch (error) {
      // A remote without this branch yet (an empty repository) is not a failure.
      if (error instanceof GitCommandError && /couldn't find remote ref|could not find remote ref/i.test(error.message)) {
        return;
      }
      throw error;
    }
    if (!hadCommit) {
      await this.git("Checking out the branch", ["checkout", "--quiet", "--force", "-B", this.branch, `refs/remotes/origin/${this.branch}`]);
      return;
    }
    await this.git("Bringing the branch up to date", ["merge", "--quiet", "--ff-only", `refs/remotes/origin/${this.branch}`]);
  }

  protected async setRemote(remote: string): Promise<void> {
    const current = await this.git("Reading the remote", ["remote"]);
    if (current.split("\n").includes("origin")) {
      await this.git("Setting the remote", ["remote", "set-url", "origin", remote]);
    } else {
      await this.git("Setting the remote", ["remote", "add", "origin", remote]);
    }
  }

  protected async isRepository(): Promise<boolean> {
    try {
      await fs.access(path.join(this.path, ".git"));
      return true;
    } catch {
      return false;
    }
  }

  protected async hasCommit(): Promise<boolean> {
    return this.succeeds(["rev-parse", "--quiet", "--verify", "HEAD^{commit}"]);
  }

  protected async hasRemoteBranch(): Promise<boolean> {
    return this.succeeds(["rev-parse", "--quiet", "--verify", `refs/remotes/origin/${this.branch}^{commit}`]);
  }

  protected async succeeds(args: string[]): Promise<boolean> {
    try {
      await this.git("Reading the working copy", args);
      return true;
    } catch (error) {
      if (error instanceof GitCommandError) {
        return false;
      }
      throw error;
    }
  }

  protected requireRemote(): string {
    if (this.remote === undefined) {
      throw new GitCommandError("This working copy has no remote", "");
    }
    return this.remote;
  }

  protected checkRemote(remote: string): string {
    let url: URL;
    try {
      url = new URL(remote);
    } catch {
      throw new GitCommandError("The remote address is not valid", "");
    }
    if (!this.protocols.includes(url.protocol.replace(/:$/, ""))) {
      throw new GitCommandError(`The remote must use one of: ${this.protocols.join(", ")}`, "");
    }
    if (url.username !== "" || url.password !== "") {
      throw new GitCommandError("The remote address must not carry a credential; give a token instead", "");
    }
    return remote;
  }

  protected checkPath(entry: string): string {
    if (typeof entry !== "string" || entry === "") {
      throw new GitCommandError("A path to commit is empty", "");
    }
    const resolved = path.resolve(this.path, entry);
    const relative = path.relative(this.path, resolved);
    if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative) || relative.split(path.sep)[0] === ".git") {
      throw new GitCommandError("A path to commit is outside the working copy", "");
    }
    return relative;
  }

  /**
   * Environment of a git command: nothing of the machine configuration, no prompt, and the
   * settings that keep the working copy within bounds. With `authenticated`, the token is added
   * as a header for the remote only.
   */
  protected async environment(authenticated: boolean): Promise<{ env: NodeJS.ProcessEnv; secrets: string[] }> {
    const settings: [string, string][] = [
      ["core.symlinks", "false"],
      ["core.hooksPath", process.platform === "win32" ? "NUL" : "/dev/null"],
      ["credential.helper", ""],
      ["http.followRedirects", "false"],
      ["protocol.allow", "never"],
      ...this.protocols.map((protocol): [string, string] => [`protocol.${protocol}.allow`, "always"]),
      ["advice.detachedHead", "false"],
    ];
    const secrets: string[] = [];
    if (authenticated && this.remote !== undefined && this.token !== undefined) {
      const token = typeof this.token === "function" ? await this.token() : this.token;
      if (token) {
        const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
        settings.push([`http.${this.remote}.extraHeader`, `Authorization: Basic ${basic}`]);
        secrets.push(token, basic);
      }
    }
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      LANG: "C",
      LC_ALL: "C",
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
      GIT_CONFIG_COUNT: String(settings.length),
    };
    settings.forEach(([key, value], index) => {
      env[`GIT_CONFIG_KEY_${index}`] = key;
      env[`GIT_CONFIG_VALUE_${index}`] = value;
    });
    return { env, secrets };
  }

  /**
   * Runs one git command in the working copy.
   *
   * @param action - What is attempted, for the error message.
   * @param args - Arguments of git.
   * @param authenticated - Whether the command talks to the remote and may send the token.
   * @returns What git printed on its standard output.
   * @throws GitCommandError when git fails; its message never holds the token.
   */
  protected async git(action: string, args: string[], authenticated = false): Promise<string> {
    const { env, secrets } = await this.environment(authenticated);
    return new Promise<string>((resolve, reject) => {
      execFile("git", args, { cwd: this.path, env, timeout: this.timeoutMs, maxBuffer: MAX_OUTPUT_BYTES }, (error, stdout, stderr) => {
        if (!error) {
          resolve(stdout);
          return;
        }
        let detail = String(stderr || error.message || "").trim();
        for (const secret of secrets) {
          detail = detail.split(secret).join("***");
        }
        reject(new GitCommandError(action, detail.slice(0, MAX_ERROR_LENGTH)));
      });
    });
  }
}
