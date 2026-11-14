import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

test("asset staging validates all inputs before replacing existing assets", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oscar-assets-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, "scripts"))
  const script = path.join(root, "scripts/oscar-stage-assets.mjs")
  fs.copyFileSync(new URL("../../scripts/oscar-stage-assets.mjs", import.meta.url), script)
  const source = path.join(root, "source")
  const inputs = [
    "images/oscar-logo-light.png",
    "images/oscar-logo-dark.png",
    "images/oscar-logo-light-48.png",
    "images/oscar-logo-dark-48.png",
    ...["regular", "medium", "bold", "mono-regular"].map((weight) => `fonts/branding/ericsson-hilda-${weight}.woff2`),
  ]
  for (const input of inputs) {
    fs.mkdirSync(path.dirname(path.join(source, input)), { recursive: true })
    fs.writeFileSync(path.join(source, input), input)
  }
  const stage = () => execFileSync(process.execPath, [script, source], { stdio: "pipe" })
  stage()
  const destination = path.join(root, "themes/oscar/private-assets")
  assert.equal(fs.readdirSync(destination).length, inputs.length)
  fs.writeFileSync(path.join(source, inputs[0]), "replacement")
  fs.rmSync(path.join(source, inputs.at(-1)))
  assert.throws(stage)
  assert.equal(fs.readFileSync(path.join(destination, "logo-light.png"), "utf8"), inputs[0])
})
