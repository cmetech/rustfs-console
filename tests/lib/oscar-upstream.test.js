import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { rehearse } from "../../scripts/oscar-upstream.js"

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oscar-upstream-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const cwd = path.join(root, "repo")
  fs.mkdirSync(cwd)
  const git = (...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true })
    fs.writeFileSync(path.join(cwd, file), text)
  }
  git("init", "-b", "main")
  git("config", "user.name", "Test")
  git("config", "user.email", "test@example.invalid")
  write("components/logo.tsx", "original\n")
  git("add", ".")
  git("commit", "-m", "baseline")
  const baseline = git("rev-parse", "HEAD")
  git("switch", "-c", "oscar")
  write(
    "docs/upstream-customizations/oscar.json",
    JSON.stringify({
      baseline,
      customizations: [{ id: "logo", downstream: ["themes/oscar"], upstream: ["components"], verify: "Check logo" }],
    }),
  )
  write("scripts/oscar-upstream.js", "// fixture\n")
  write(".agents/skills/oscar-upstream-merge/SKILL.md", "fixture\n")
  git("add", ".")
  git("commit", "-m", "controls")
  git("switch", "-c", "upstream", baseline)
  write("components/logo.tsx", "upstream fix\n")
  git("add", ".")
  git("commit", "-m", "upstream fix")
  const target = git("rev-parse", "HEAD")
  git("switch", "oscar")
  return { cwd, root, git, write, target }
}

test("reports overlay overlaps and trials without touching branch or dirty work", (t) => {
  const f = fixture(t)
  const head = f.git("rev-parse", "HEAD")
  f.write("local.txt", "unsaved work")
  const report = rehearse(f.target, { cwd: f.cwd, trial: path.join(f.root, "trial") })
  assert.deepEqual(report.review[0].changed, ["components/logo.tsx"])
  assert.equal(report.trial.status, "clean")
  assert.equal(f.git("rev-parse", "HEAD"), head)
  assert.equal(f.git("branch", "--show-current"), "oscar")
  assert.equal(fs.readFileSync(path.join(f.cwd, "local.txt"), "utf8"), "unsaved work")
  assert.equal(fs.readFileSync(path.join(f.root, "trial/components/logo.tsx"), "utf8"), "upstream fix\n")
})

test("keeps merge conflicts isolated for review", (t) => {
  const f = fixture(t)
  f.write("components/logo.tsx", "OSCAR logo\n")
  f.git("add", ".")
  f.git("commit", "-m", "brand")
  const report = rehearse(f.target, { cwd: f.cwd, trial: path.join(f.root, "trial") })
  assert.equal(report.trial.status, "conflicts")
  assert.deepEqual(report.trial.conflicts, ["components/logo.tsx"])
  assert.equal(f.git("status", "--porcelain"), "")
})

test("rejects mutable targets, changed controls, nested destinations, and forked main", (t) => {
  const f = fixture(t)
  assert.throws(() => rehearse("upstream", { cwd: f.cwd }), /immutable/)
  assert.throws(() => rehearse(f.target, { cwd: f.cwd, trial: path.join(f.cwd, "trial") }), /outside/)
  f.write("scripts/oscar-upstream.js", "// changed\n")
  assert.throws(() => rehearse(f.target, { cwd: f.cwd, trial: path.join(f.root, "trial") }), /Commit merge-control/)
  f.git("branch", "-f", "main", "oscar")
  assert.throws(() => rehearse(f.target, { cwd: f.cwd }))
  assert.equal(fs.existsSync(path.join(f.root, "trial")), false)
})

test("flags the old overlay target when upstream moves it outside a watched directory", (t) => {
  const f = fixture(t)
  f.git("switch", "upstream")
  fs.mkdirSync(path.join(f.cwd, "src"))
  f.git("mv", "components/logo.tsx", "src/logo.tsx")
  f.git("commit", "-m", "move logo")
  const target = f.git("rev-parse", "HEAD")
  f.git("switch", "oscar")
  assert.deepEqual(rehearse(target, { cwd: f.cwd }).review[0].changed, ["components/logo.tsx"])
})
