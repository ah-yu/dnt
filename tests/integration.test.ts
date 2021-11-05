// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.109.0/testing/asserts.ts";
import { build, BuildOptions } from "../mod.ts";

Deno.test("should build", async () => {
  await runTest("test_project", {
    entryPoints: ["mod.ts"],
    outDir: "./npm",
    package: {
      name: "add",
      version: "1.0.0",
    },
  }, (output) => {
    assertEquals(output.packageJson, {
      name: "add",
      version: "1.0.0",
      main: "./umd/mod.js",
      module: "./esm/mod.js",
      exports: {
        ".": {
          import: "./esm/mod.js",
          require: "./umd/mod.js",
          types: "./types/mod.d.ts",
        },
      },
      scripts: {
        test: "node test_runner.js",
      },
      types: "./types/mod.d.ts",
      dependencies: {
        tslib: "2.3.1",
      },
      devDependencies: {
        "@types/node": "16.11.1",
        chalk: "4.1.2",
        "deno.ns": "0.6.4",
      },
    });
    assertEquals(
      output.npmIgnore,
      `src/
esm/mod.test.js
umd/mod.test.js
esm/deps/deno_land_std_0_109_0/fmt/colors.js
umd/deps/deno_land_std_0_109_0/fmt/colors.js
esm/deps/deno_land_std_0_109_0/testing/_diff.js
umd/deps/deno_land_std_0_109_0/testing/_diff.js
esm/deps/deno_land_std_0_109_0/testing/asserts.js
umd/deps/deno_land_std_0_109_0/testing/asserts.js
test_runner.js
`,
    );
  });
});

Deno.test("should build with all options off", async () => {
  await runTest("test_project", {
    entryPoints: ["mod.ts"],
    outDir: "./npm",
    typeCheck: false,
    cjs: false,
    declaration: false,
    test: false,
    package: {
      name: "add",
      version: "1.0.0",
    },
  }, (output) => {
    assertEquals(output.packageJson, {
      name: "add",
      version: "1.0.0",
      module: "./esm/mod.js",
      exports: {
        ".": {
          import: "./esm/mod.js",
        },
      },
      dependencies: {
        tslib: "2.3.1",
      },
      devDependencies: {},
    });

    output.assertNotExists("./umd/mod.js");
    output.assertNotExists("./types/mod.js");

    // This doesn't include the test files because they're not analyzed for in this scenario.
    assertEquals(
      output.npmIgnore,
      `src/
test_runner.js
`,
    );
  });
});

Deno.test("should build bin project", async () => {
  await runTest("test_project", {
    entryPoints: [{
      kind: "bin",
      name: "add",
      path: "./mod.ts",
    }],
    outDir: "./npm",
    package: {
      name: "add",
      version: "1.0.0",
    },
  }, (output) => {
    assertEquals(output.packageJson, {
      name: "add",
      version: "1.0.0",
      bin: {
        add: "./esm/mod.js",
      },
      scripts: {
        test: "node test_runner.js",
      },
      dependencies: {
        tslib: "2.3.1",
      },
      devDependencies: {
        "@types/node": "16.11.1",
        chalk: "4.1.2",
        "deno.ns": "0.6.4",
      },
      exports: {},
    });
    const expectedText = "#!/usr/bin/env node\n";
    assertEquals(
      output.getFileText("umd/mod.js").substring(0, expectedText.length),
      expectedText,
    );
    assertEquals(
      output.getFileText("esm/mod.js").substring(0, expectedText.length),
      expectedText,
    );
  });
});

Deno.test("error for TLA when emitting CommonJS", async () => {
  await assertRejects(() =>
    runTest("tla_project", {
      entryPoints: ["mod.ts"],
      outDir: "./npm",
      package: {
        name: "add",
        version: "1.0.0",
      },
    })
  );
});

Deno.test("not error for TLA when not using CommonJS", async () => {
  await runTest("tla_project", {
    entryPoints: ["mod.ts"],
    outDir: "./npm",
    cjs: false, // ok, because cjs is disabled now
    package: {
      name: "add",
      version: "1.0.0",
    },
  }, (output) => {
    assertEquals(output.packageJson, {
      name: "add",
      version: "1.0.0",
      module: "./esm/mod.js",
      exports: {
        ".": {
          import: "./esm/mod.js",
          types: "./types/mod.d.ts",
        },
      },
      scripts: {
        test: "node test_runner.js",
      },
      types: "./types/mod.d.ts",
      dependencies: {
        tslib: "2.3.1",
      },
      devDependencies: {
        "@types/node": "16.11.1",
        chalk: "4.1.2",
        "deno.ns": "0.6.4",
      },
    });
  });
});

export interface Output {
  packageJson: any;
  npmIgnore: string;
  getFileText(filePath: string): string;
  assertNotExists(filePath: string): void;
}

async function runTest(
  project: "test_project" | "tla_project",
  options: BuildOptions,
  checkOutput?: (output: Output) => (Promise<void> | void),
) {
  const originalCwd = Deno.cwd();
  Deno.chdir(`./tests/${project}`);
  try {
    await build(options);
    const getFileText = (filePath: string) => {
      return Deno.readTextFileSync(options.outDir + "/" + filePath);
    };
    if (checkOutput) {
      const packageJson = JSON.parse(getFileText("package.json"));
      const npmIgnore = getFileText(".npmignore");
      await checkOutput({
        packageJson,
        npmIgnore,
        getFileText,
        assertNotExists(filePath) {
          try {
            Deno.statSync(filePath);
            throw new Error(`Found file at ${filePath}`);
          } catch (err) {
            if (!(err instanceof Deno.errors.NotFound)) {
              throw err;
            }
          }
        },
      });
    }
  } finally {
    Deno.removeSync(options.outDir, { recursive: true });
    Deno.chdir(originalCwd);
  }
}