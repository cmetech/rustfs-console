import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

test("OSCAR removes competing file icons and switching back restores upstream icons", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oscar-icons-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, "scripts"))
  fs.mkdirSync(path.join(root, "app"))
  fs.writeFileSync(path.join(root, "package.json"), '{"type":"module"}')
  fs.copyFileSync("scripts/apply-theme-overrides.js", path.join(root, "scripts/apply-theme-overrides.js"))
  for (const theme of ["default", "oscar"]) {
    fs.mkdirSync(path.join(root, "themes", theme), { recursive: true })
    fs.writeFileSync(path.join(root, "themes", theme, "manifest.json"), JSON.stringify({ id: theme }))
  }
  const icons = ["favicon.ico", "icon.svg", "icon16.png", "icon32.png", "apple-icon.png"]
  for (const name of icons) fs.writeFileSync(path.join(root, "app", name), `original:${name}`)
  const apply = (theme) =>
    execFileSync(process.execPath, [path.join(root, "scripts/apply-theme-overrides.js")], {
      env: { ...process.env, NEXT_PUBLIC_THEME_ID: theme },
    })
  apply("oscar")
  for (const name of icons) assert.equal(fs.existsSync(path.join(root, "app", name)), false)
  apply("oscar")
  apply("default")
  for (const name of icons) assert.equal(fs.readFileSync(path.join(root, "app", name), "utf8"), `original:${name}`)
})
