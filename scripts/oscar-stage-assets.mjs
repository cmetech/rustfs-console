import { copyFileSync, mkdirSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const source = process.argv[2]
if (!source) throw new Error("Usage: node scripts/oscar-stage-assets.mjs /path/to/oscar-adminui/public")
const destination = fileURLToPath(new URL("../themes/oscar/private-assets/", import.meta.url))
const files = [
  ["images/oscar-logo-light.png", "logo-light.png"],
  ["images/oscar-logo-dark.png", "logo-dark.png"],
  ["images/oscar-logo-light-48.png", "symbol-light.png"],
  ["images/oscar-logo-dark-48.png", "symbol-dark.png"],
  ...["regular", "medium", "bold", "mono-regular"].map((weight) => [
    `fonts/branding/ericsson-hilda-${weight}.woff2`,
    `ericsson-hilda-${weight}.woff2`,
  ]),
]
// Validate the complete input set before replacing any previously staged assets.
for (const [input] of files) {
  if (!statSync(resolve(source, input)).isFile()) throw new Error(`Not a file: ${input}`)
}
mkdirSync(destination, { recursive: true })
for (const [input, output] of files) copyFileSync(resolve(source, input), resolve(destination, output))
console.log("Staged local OSCAR assets. They are gitignored; distribute builds only through approved OSCAR channels.")
