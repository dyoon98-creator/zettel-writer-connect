#!/usr/bin/env node
// Dummy CLI for CodexCLIAdapter integration tests.
//
// Modes (mutually exclusive flags):
//   --ok    : prints "OK output\nline2" to stdout, exits 0
//   --fail  : prints "boom" to stderr, exits 2
//   --slow  : sleeps 5s then prints "late" (used to verify timeout)
//   --echo  : reads stdin, prints back what it received

const args = process.argv.slice(2);
const has = (n) => args.includes(n);

async function main() {
  if (has("--ok")) {
    process.stdout.write("OK output\nline2");
    process.exit(0);
  }
  if (has("--fail")) {
    process.stderr.write("boom");
    process.exit(2);
  }
  if (has("--slow")) {
    setTimeout(() => {
      process.stdout.write("late");
      process.exit(0);
    }, 5000);
    return;
  }
  if (has("--echo")) {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      buf += chunk;
    });
    process.stdin.on("end", () => {
      process.stdout.write(buf);
      process.exit(0);
    });
    return;
  }
  // Default: no-op success
  process.exit(0);
}

main();
