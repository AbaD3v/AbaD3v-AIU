import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Preview runners may supply Vite-style arguments; normalize them for Next.
const args = process.argv
  .slice(2)
  .filter((argument) => argument !== "--strictPort")
  .map((argument) => (argument === "--host" ? "--hostname" : argument));
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "dev", "--webpack", ...args],
  { stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
