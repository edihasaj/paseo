import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative as relativePath } from "node:path";
import test from "node:test";

const repoRoot = new URL("../", import.meta.url);
const ciWorkflowPath = new URL(".github/workflows/ci.yml", repoRoot);
const dockerWorkflowPath = new URL(".github/workflows/docker.yml", repoRoot);
const nixWorkflowPath = new URL(".github/workflows/nix.yml", repoRoot);
const filtersPath = new URL(".github/ci-paths.yml", repoRoot);
const serverTsconfigPath = new URL("packages/server/tsconfig.server.json", repoRoot);
const desktopPackagePath = new URL("packages/desktop/package.json", repoRoot);
const desktopBuilderPath = new URL("packages/desktop/electron-builder.yml", repoRoot);
const nixDesktopPackagePath = new URL("nix/desktop-package.nix", repoRoot);
const nixPackagePath = new URL("nix/package.nix", repoRoot);
const lockfilePath = new URL("package-lock.json", repoRoot);
const traceDaemonPath = new URL("scripts/trace-daemon.mjs", repoRoot);
const packagedWebDaemonPath = new URL(
  "packages/app/e2e/support/helpers/packaged-web-daemon.ts",
  repoRoot,
);
const sidebarHelpSpecPath = new URL("packages/app/e2e/browser/sidebar-help.spec.ts", repoRoot);
const releaseConsumerPaths = [
  "packages/app/src/desktop/updates/desktop-updates.ts",
  "packages/cli/src/commands/onboard.ts",
  "packages/website/src/components/site-footer.tsx",
  "packages/website/src/downloads.tsx",
  "packages/website/src/latest-release.ts",
  "packages/website/src/routes/download.tsx",
];

const gatedCiJobs = new Map([
  ["format", { name: "format", contract: "format" }],
  ["lint", { name: "lint", contract: "quality" }],
  ["typecheck", { name: "typecheck", contract: "quality" }],
  ["server-tests-ubuntu", { name: "server-tests (ubuntu-latest)", contracts: ["server", "hub"] }],
  ["server-tests-windows", { name: "server-tests (windows-latest)", contracts: ["server", "hub"] }],
  ["desktop-tests-ubuntu", { name: "desktop-tests (ubuntu-latest)", contract: "desktop" }],
  ["desktop-tests-windows", { name: "desktop-tests (windows-latest)", contract: "desktop" }],
  ["app-tests", { name: "app-tests", contract: "app" }],
  ["sdk-tests", { name: "sdk-tests", contract: "sdk" }],
  ["playwright-1", { name: "playwright (shard 1/4)", contract: "browser" }],
  ["playwright-2", { name: "playwright (shard 2/4)", contract: "browser" }],
  ["playwright-3", { name: "playwright (shard 3/4)", contract: "browser" }],
  ["playwright-4", { name: "playwright (shard 4/4)", contract: "browser" }],
  ["relay-tests", { name: "relay-tests", contract: "relay" }],
  ["cli-tests-1", { name: "cli-tests (shard 1/3)", contract: "cli" }],
  ["cli-tests-2", { name: "cli-tests (shard 2/3)", contract: "cli" }],
  ["cli-tests-3", { name: "cli-tests (shard 3/3)", contract: "cli" }],
]);

function jobBlocks(source) {
  const jobs = new Map();
  let currentJob;

  for (const line of source.split("\n")) {
    const jobMatch = /^  ([a-z0-9-]+):\s*$/.exec(line);
    if (jobMatch) {
      currentJob = jobMatch[1];
      jobs.set(currentJob, []);
      continue;
    }
    if (currentJob) jobs.get(currentJob).push(line);
  }
  return jobs;
}

function loadFilters(path) {
  const filters = {};
  let currentFilter;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const filterMatch = /^([a-z_]+):\s*$/.exec(line);
    if (filterMatch) {
      currentFilter = filterMatch[1];
      filters[currentFilter] = [];
      continue;
    }
    const patternMatch = /^  - "([^"]+)"\s*$/.exec(line);
    if (currentFilter && patternMatch) filters[currentFilter].push(patternMatch[1]);
  }
  return filters;
}

function filesUnder(relativeDirectory, predicate) {
  const directory = new URL(`${relativeDirectory}/`, repoRoot);
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      [relativeDirectory, relativePath(directory.pathname, entry.parentPath), entry.name]
        .filter(Boolean)
        .join("/")
        .replaceAll("\\", "/"),
    )
    .filter(predicate)
    .sort();
}

test("gated checks are statically named jobs with real job-level gating", () => {
  const workflowSource = readFileSync(ciWorkflowPath, "utf8");
  const jobs = jobBlocks(workflowSource);
  const trigger = workflowSource.split("jobs:", 1)[0];

  assert.match(trigger, /^\s+merge_group:\s*$/m);
  assert.doesNotMatch(workflowSource, /strategy:\s*\n\s+matrix:/);
  assert.doesNotMatch(workflowSource, /RUN_TESTS|Skip unaffected|No .* changes detected/);

  for (const [jobId, expected] of gatedCiJobs) {
    const job = jobs.get(jobId)?.join("\n");
    assert.ok(job, `missing static job ${jobId}`);
    assert.match(job, new RegExp(`^    name: ${expected.name.replace(/[()]/g, "\\$&")}$`, "m"));
    assert.match(job, /needs\.changes\.outputs\.full != 'false'/);
    for (const contract of expected.contracts ?? [expected.contract]) {
      assert.match(job, new RegExp(`needs\\.changes\\.outputs\\.${contract} != 'false'`));
    }
  }
});

test("change gating allows superseded workflow runs to cancel", () => {
  for (const workflowPath of [ciWorkflowPath, dockerWorkflowPath, nixWorkflowPath]) {
    const source = readFileSync(workflowPath, "utf8");
    assert.doesNotMatch(
      source,
      /\$\{\{\s*always\(\)/,
      "always() keeps jobs alive after concurrency cancellation; use !cancelled() for fail-open gating",
    );
  }
});

test("focused contracts stay inside existing required checks", () => {
  const jobs = jobBlocks(readFileSync(ciWorkflowPath, "utf8"));
  const changes = jobs.get("changes")?.join("\n") ?? "";
  const server = jobs.get("server-tests-ubuntu")?.join("\n") ?? "";
  const desktop = jobs.get("desktop-tests-ubuntu")?.join("\n") ?? "";

  assert.match(changes, /scripts\/daemon-launch-contract\.test\.mjs/);
  assert.doesNotMatch(changes, /Install dependencies|npm run build/);

  assert.match(server, /test:hub-cli-contract/);
  assert.match(server, /npm run test --workspace=@getpaseo\/server/);
  assert.ok(!jobs.has("hub-cli-contract"));

  assert.match(desktop, /test:e2e:renderer/);
  assert.match(desktop, /test:e2e:browser-tabs/);
  assert.match(desktop, /npm run test --workspace=@getpaseo\/desktop/);
  assert.ok(!jobs.has("desktop-browser-bridge"));
  assert.ok(!jobs.has("playwright-desktop"));
});

test("required PR surfaces keep their hosted commands and complete shard matrix", () => {
  const jobs = jobBlocks(readFileSync(ciWorkflowPath, "utf8"));
  const lint = jobs.get("lint")?.join("\n") ?? "";
  const typecheck = jobs.get("typecheck")?.join("\n") ?? "";
  const app = jobs.get("app-tests")?.join("\n") ?? "";
  const firstPlaywright = jobs.get("playwright-1")?.join("\n") ?? "";

  assert.match(lint, /run: npm run lint/);
  assert.match(typecheck, /run: npm run build:server/);
  assert.match(typecheck, /run: npm run typecheck/);
  assert.match(app, /run: npm run build:app-deps/);
  assert.match(app, /run: npm run test --workspace=@getpaseo\/app/);

  assert.match(firstPlaywright, /steps: &playwright_test_steps/);
  assert.match(firstPlaywright, /run: npm run build:server/);
  assert.match(
    firstPlaywright,
    /run: npm run test:e2e --workspace=@getpaseo\/app -- --shard=\$\{\{ env\.PLAYWRIGHT_SHARD \}\}/,
  );

  for (let shard = 1; shard <= 4; shard += 1) {
    const job = jobs.get(`playwright-${shard}`)?.join("\n") ?? "";
    assert.match(job, new RegExp(`PLAYWRIGHT_SHARD: "${shard}/4"`));
    assert.match(job, new RegExp(`PLAYWRIGHT_ARTIFACT: "${shard}"`));
    if (shard > 1) assert.match(job, /steps: \*playwright_test_steps/);
  }
});

test("Docker pull requests build the source tree for both published architectures", () => {
  const source = readFileSync(dockerWorkflowPath, "utf8");
  const trigger = source.split("jobs:", 1)[0];
  const jobs = jobBlocks(source);
  const build = jobs.get("build")?.join("\n") ?? "";

  assert.match(trigger, /^\s+pull_request:\s*$/m);
  for (const changedInput of [
    '      - "package-lock.json"',
    '      - "scripts/**"',
    '      - "packages/app/**"',
    '      - "packages/cli/**"',
  ]) {
    assert.match(trigger, new RegExp(changedInput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(source, /^\s+PLATFORMS: linux\/amd64,linux\/arm64$/m);
  assert.match(build, /uses: docker\/build-push-action@v7/);
  assert.match(build, /^\s+context: \.$/m);
  assert.match(build, /^\s+file: docker\/base\/Dockerfile$/m);
  assert.match(build, /^\s+platforms: \$\{\{ env\.PLATFORMS \}\}$/m);
  assert.match(build, /^\s+push: false$/m);
});

test("server builds exclude test utilities at every domain depth", () => {
  const tsconfig = JSON.parse(readFileSync(serverTsconfigPath, "utf8"));
  assert.ok(tsconfig.exclude.includes("src/server/**/test-utils/**"));
  assert.ok(!tsconfig.exclude.includes("src/server/test-utils/**"));
});

test("PR routing declares stable behavior ownership", () => {
  const filters = loadFilters(filtersPath);
  assert.deepEqual(filters, {
    routing: [".github/ci-paths.yml"],
    workspace: [
      ".mise.toml",
      ".tool-versions",
      "package.json",
      "package-lock.json",
      "patches/**",
      "scripts/**",
      "tsconfig.json",
      "tsconfig.base.json",
      "vitest.config.ts",
    ],
    ci: [".github/actions/**", ".github/workflows/ci.yml"],
    format: [
      ".agents/**/*.{cjs,css,html,js,json,jsonc,jsx,md,mjs,ts,tsx,yaml,yml}",
      ".github/**/*.{cjs,css,html,js,json,jsonc,jsx,md,mjs,ts,tsx,yaml,yml}",
      "**/*.{cjs,css,html,js,json,jsonc,jsx,md,mjs,ts,tsx,yaml,yml}",
      "packages/expo-two-way-audio/**",
    ],
    quality: ["**/*.{cjs,js,json,jsx,mjs,ts,tsx}", "packages/expo-two-way-audio/**"],
    hub: ["packages/cli/src/commands/hub/**", "packages/server/src/server/hub/**"],
    server: ["packages/server/**", "packages/app/e2e/support/fixtures/recording.*"],
    desktop: [
      "packages/desktop/**",
      "packages/app/src/desktop/**",
      "packages/server/src/server/browser-tools/**",
      "packages/app/e2e/support/**",
      "packages/app/*config.{cjs,js,ts}",
      "packages/app/package.json",
    ],
    app: ["packages/app/**", "packages/expo-two-way-audio/**"],
    sdk: ["packages/client/**", "packages/highlight/**", "packages/protocol/**"],
    browser: [
      "packages/app/src/!(desktop)/**",
      "packages/app/e2e/browser/**",
      "packages/app/e2e/support/**",
      "packages/app/assets/**",
      "packages/app/public/**",
      "packages/app/index.ts",
      "packages/app/*config.{cjs,js,ts}",
      "packages/app/package.json",
    ],
    relay: ["packages/relay/**"],
    cli: ["packages/cli/**"],
  });
});

test("cross-package invariants live in the suite that owns them", () => {
  const cliTests = filesUnder("packages/cli", (path) => path.endsWith(".test.ts"));
  assert.ok(cliTests.length > 0);
  for (const path of cliTests) {
    assert.doesNotMatch(
      readFileSync(new URL(path, repoRoot), "utf8"),
      /server\/src\/server\/test-utils/,
      path,
    );
  }

  const protocolWireCompatibility = new URL(
    "packages/protocol/src/messages.wire-compat.test.ts",
    repoRoot,
  );
  assert.match(readFileSync(protocolWireCompatibility, "utf8"), /wire schema compatibility/);
});

test("browser and desktop tests have exclusive, directory-owned suites", () => {
  const filters = loadFilters(filtersPath);
  const browserSpecs = filesUnder("packages/app/e2e", (path) => path.endsWith(".spec.ts"));
  const desktopSpecs = filesUnder("packages/desktop/e2e", (path) => path.endsWith(".spec.ts"));
  const electronModules = filesUnder("packages/app/src", (path) => /\.electron\.tsx?$/.test(path));

  assert.ok(browserSpecs.length > 0);
  assert.ok(desktopSpecs.length > 0);
  assert.ok(browserSpecs.every((path) => path.startsWith("packages/app/e2e/browser/")));
  assert.ok(desktopSpecs.every((path) => path.startsWith("packages/desktop/e2e/")));
  assert.ok(electronModules.every((path) => path.startsWith("packages/app/src/desktop/")));

  const desktopPackage = JSON.parse(readFileSync(desktopPackagePath, "utf8"));
  assert.match(desktopPackage.scripts.test, /--exclude ["']e2e\/\*\*["']/);

  for (const path of browserSpecs) {
    assert.doesNotMatch(
      readFileSync(new URL(path, repoRoot), "utf8"),
      /paseoDesktop|injectDesktopBridge/,
    );
  }
  for (const path of desktopSpecs) {
    assert.ok(path.startsWith("packages/desktop/e2e/"));
  }

  const routingSource = readFileSync(filtersPath, "utf8");
  assert.doesNotMatch(routingSource, /desktop_bridge|playwright_desktop|browser-\*|browser-\*\//);
  assert.deepEqual(filters.desktop, [
    "packages/desktop/**",
    "packages/app/src/desktop/**",
    "packages/server/src/server/browser-tools/**",
    "packages/app/e2e/support/**",
    "packages/app/*config.{cjs,js,ts}",
    "packages/app/package.json",
  ]);
  assert.deepEqual(filters.browser, [
    "packages/app/src/!(desktop)/**",
    "packages/app/e2e/browser/**",
    "packages/app/e2e/support/**",
    "packages/app/assets/**",
    "packages/app/public/**",
    "packages/app/index.ts",
    "packages/app/*config.{cjs,js,ts}",
    "packages/app/package.json",
  ]);
});

test("non-required Docker and Nix workflows avoid runners with workflow path filters", () => {
  for (const workflowPath of [dockerWorkflowPath, nixWorkflowPath]) {
    const source = readFileSync(workflowPath, "utf8");
    const trigger = source.split("jobs:", 1)[0];
    assert.match(trigger, /^\s+paths:\s*$/m);
    assert.doesNotMatch(source, /dorny\/paths-filter/);
  }
});

test("Nix builds verify one shared dependency input before platform builds", () => {
  const workflow = readFileSync(nixWorkflowPath, "utf8");
  const jobs = jobBlocks(workflow);
  const nixPackage = readFileSync(nixPackagePath, "utf8");
  const nixDesktopPackage = readFileSync(nixDesktopPackagePath, "utf8");

  const linuxJob = jobs.get("build")?.join("\n");
  assert.ok(linuxJob, "missing Nix build job");
  const nodeIndex = linuxJob.indexOf("uses: actions/setup-node@v4");
  const verifyIndex = linuxJob.indexOf("run: ./scripts/update-nix.sh --check");
  const linuxBuildIndex = linuxJob.indexOf("run: nix build");
  assert.ok(nodeIndex >= 0, "build does not provision Node for the Nix input check");
  assert.ok(verifyIndex > nodeIndex, "build verifies the Nix input before provisioning Node");
  assert.ok(linuxBuildIndex > verifyIndex, "build runs before verifying the Nix dependency input");

  const darwinJob = jobs.get("build-desktop-darwin")?.join("\n");
  assert.ok(darwinJob, "missing Darwin Nix build job");
  assert.match(darwinJob, /run: nix build \.#desktop/);
  assert.doesNotMatch(darwinJob, /actions\/setup-node|update-nix\.sh/);

  assert.equal(workflow.match(/run: \.\/scripts\/update-nix\.sh --check/g)?.length, 1);
  assert.doesNotMatch(workflow, /run: \.\/scripts\/update-nix\.sh\s*(?:\n|$)/);

  assert.match(nixPackage, /builtins\.hashFile "sha256" \.\.\/package-lock\.json/);
  assert.match(nixPackage, /npmDeps = importNpmLock \{/);
  assert.match(nixPackage, /package = rootPackage/);
  assert.match(nixPackage, /inherit packageLock/);
  assert.match(nixPackage, /npmRoot = \.\/\.\.;/);
  assert.match(nixPackage, /npmConfigHook = importNpmLock\.npmConfigHook/);
  assert.doesNotMatch(nixPackage, /inherit npmDepsHash/);
  assert.match(nixDesktopPackage, /inherit \(paseo\) npmDeps/);
  assert.match(nixDesktopPackage, /npmConfigHook = importNpmLock\.npmConfigHook/);
});

test("hosted tooling follows the CLI package's declared executable and compatibility alias", () => {
  const cliPackage = JSON.parse(
    readFileSync(new URL("packages/cli/package.json", repoRoot), "utf8"),
  );
  const lockfile = JSON.parse(readFileSync(lockfilePath, "utf8"));
  const traceDaemon = readFileSync(traceDaemonPath, "utf8");
  const packagedWebDaemon = readFileSync(packagedWebDaemonPath, "utf8");
  const knipConfig = JSON.parse(readFileSync(new URL("knip.json", repoRoot), "utf8"));
  const nixPackage = readFileSync(nixPackagePath, "utf8");
  const nixWorkflow = readFileSync(nixWorkflowPath, "utf8");
  assert.deepEqual(cliPackage.bin, {
    paseo: "bin/stroll",
    stroll: "bin/stroll",
  });
  assert.deepEqual(lockfile.packages["packages/cli"].bin, cliPackage.bin);
  assert.match(traceDaemon, /"packages\/cli\/bin\/stroll"/);
  assert.doesNotMatch(traceDaemon, /"packages\/cli\/bin\/paseo"/);
  assert.ok(existsSync(new URL("packages/cli/bin/stroll", repoRoot)));
  assert.match(packagedWebDaemon, /node_modules\/\.bin\/stroll/);
  assert.doesNotMatch(packagedWebDaemon, /node_modules\/\.bin\/paseo/);
  assert.ok(knipConfig.workspaces["packages/cli"].entry.includes("bin/stroll"));
  assert.match(nixPackage, /\$out\/bin\/stroll/);
  assert.match(nixPackage, /ln -s stroll \$out\/bin\/paseo/);
  assert.match(nixPackage, /mainProgram = "stroll"/);
  assert.match(nixWorkflow, /\.\/result\/bin\/stroll daemon status/);
  assert.match(nixWorkflow, /test -x \.\/result\/bin\/paseo/);
});

test("Nix Darwin packaging follows the existing Electron application identity", () => {
  const desktopBuilder = readFileSync(desktopBuilderPath, "utf8");
  const nixDesktopPackage = readFileSync(nixDesktopPackagePath, "utf8");
  const nixWorkflow = readFileSync(nixWorkflowPath, "utf8");
  const sidebarHelpSpec = readFileSync(sidebarHelpSpecPath, "utf8");

  assert.match(desktopBuilder, /^appId: com\.edihasaj\.stroll\.desktop$/m);
  assert.match(desktopBuilder, /^productName: Stroll$/m);
  assert.match(desktopBuilder, /^executableName: Stroll$/m);
  assert.match(desktopBuilder, /^\s+- stroll$/m);
  assert.match(sidebarHelpSpec, /const APP_VERSION = \/\^Stroll\\s\*/);
  assert.match(nixDesktopPackage, /Applications\/Stroll\.app\/Contents\/MacOS\/Stroll/);
  assert.match(nixDesktopPackage, /EXPO_DEV_URL "stroll:\/\/app\/"/);
  assert.match(nixWorkflow, /Applications\/Stroll\.app/);
  assert.match(nixWorkflow, /com\.edihasaj\.stroll\.desktop/);
});

test("Stroll release consumers follow the desktop publisher", () => {
  const desktopBuilder = readFileSync(desktopBuilderPath, "utf8");
  const owner = /^\s+owner: (\S+)$/m.exec(desktopBuilder)?.[1];
  const repository = /^\s+repo: (\S+)$/m.exec(desktopBuilder)?.[1];
  assert.equal(`${owner}/${repository}`, "edihasaj/paseo");

  for (const consumerPath of releaseConsumerPaths) {
    const source = readFileSync(new URL(consumerPath, repoRoot), "utf8");
    assert.match(source, /edihasaj\/paseo/, `${consumerPath} does not use the desktop publisher`);
    assert.doesNotMatch(
      source,
      /(?:github:getpaseo\/paseo|getpaseo\/paseo\/(?:releases|v\$\{version\}))/,
    );
  }
});
