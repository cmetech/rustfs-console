import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ledgerPath = "docs/upstream-customizations/oscar.json"
const controls = [ledgerPath, "scripts/oscar-upstream.js", ".agents/skills/oscar-upstream-merge/SKILL.md"]

export function rehearse(target, { cwd = process.cwd(), trial } = {}) {
  const git = (...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
  const ancestor = (base, tip) => git("merge-base", "--is-ancestor", base, tip)
  if (!/^[a-f0-9]{40}$/.test(target))
    throw new Error("Target must be a full immutable commit SHA (fetch upstream first)")
  const root = git("rev-parse", "--show-toplevel")
  if (git("rev-parse", `${target}^{commit}`) !== target) throw new Error("Target must identify a commit")
  if (git("branch", "--show-current") !== "oscar") throw new Error("Run from the oscar branch; main is upstream-only")
  const ledger = JSON.parse(fs.readFileSync(path.join(root, ledgerPath), "utf8"))
  if (!/^[a-f0-9]{40}$/.test(ledger.baseline) || !Array.isArray(ledger.customizations))
    throw new Error("Invalid customization ledger")
  const head = git("rev-parse", "HEAD")
  ancestor(ledger.baseline, target)
  ancestor(ledger.baseline, head)
  ancestor("main", target)
  const changed = git("diff", "--no-renames", "--name-only", "-z", ledger.baseline, target).split("\0").filter(Boolean)
  const report = {
    baseline: ledger.baseline,
    target,
    head,
    changed,
    review: ledger.customizations.map((entry) => ({
      id: entry.id,
      downstream: entry.downstream,
      verify: entry.verify,
      changed: changed.filter((file) => entry.upstream.some((watch) => file === watch || file.startsWith(`${watch}/`))),
    })),
    workingTreeChanges: git("status", "--porcelain"),
    trial: null,
  }
  if (!trial) return report
  for (const control of controls) {
    git("ls-files", "--error-unmatch", "--", control)
    if (git("status", "--porcelain", "--", control))
      throw new Error(`Commit merge-control changes before rehearsal: ${control}`)
  }
  const requested = path.resolve(trial)
  const destination = path.join(fs.realpathSync(path.dirname(requested)), path.basename(requested))
  const relative = path.relative(root, destination)
  if (!relative.startsWith(`..${path.sep}`) && relative !== "..")
    throw new Error("Trial worktree must be outside the working repository")
  if (fs.existsSync(destination)) throw new Error("Trial destination must not exist")
  git("worktree", "add", "--detach", destination, head)
  report.trial = { path: destination, status: "clean", conflicts: [] }
  try {
    execFileSync("git", ["-c", "rerere.enabled=false", "merge", "--no-commit", "--no-ff", target], {
      cwd: destination,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (error) {
    report.trial.conflicts = execFileSync("git", ["diff", "--name-only", "--diff-filter=U"], {
      cwd: destination,
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean)
    if (!report.trial.conflicts.length)
      throw new Error(`Trial merge failed; inspect ${destination}: ${error.stderr || error.message}`)
    report.trial.status = "conflicts"
  }
  return report
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [target, option, trial, ...extra] = process.argv.slice(2)
    if (extra.length || (option && (option !== "--trial" || !trial)))
      throw new Error("Usage: node scripts/oscar-upstream.js <full-sha> [--trial /outside/repo/new-path]")
    const report = rehearse(target, { trial })
    console.log(JSON.stringify(report, null, 2))
    if (report.trial?.status === "conflicts") process.exitCode = 2
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
