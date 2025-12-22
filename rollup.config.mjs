import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import path from "node:path";
import url from "node:url";
import json from "@rollup/plugin-json";
import { readFileSync } from "node:fs";

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = "com.thedanielcer.tab-wizard.sdPlugin";

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
	input: "src/plugin.ts",
	output: {
		file: `${sdPlugin}/bin/plugin.js`,
		sourcemap: isWatching,
		sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
			return url.pathToFileURL(path.resolve(path.dirname(sourcemapPath), relativeSourcePath)).href;
		}
	},
	external: ["sharp", "@img/sharp-win32-x64", "@img/sharp-wasm32"],
	plugins: [
		{
			name: "watch-externals",
			buildStart: function () {
				this.addWatchFile(`${sdPlugin}/manifest.json`);
				this.addWatchFile("src/ps1/focus-edge.ps1");
			},
		},
		typescript({
			mapRoot: isWatching ? "./" : undefined
		}),
		json(),
		nodeResolve({
			browser: false,
			exportConditions: ["node"],
			preferBuiltins: true
		}),
		commonjs({ ignoreDynamicRequires: true }),
		!isWatching && terser(),
		{
			name: "emit-module-package-file",
			generateBundle() {
				this.emitFile({ fileName: "package.json", source: `{ "type": "module" }`, type: "asset" });
			}
		},
		{
			name: "copy-ps1",
			generateBundle() {
				const script = readFileSync("src/ps1/focus-edge.ps1", "utf8");
				// Place alongside plugin.js (which lives in bin/); avoid nested bin/bin
				this.emitFile({ type: "asset", fileName: "ps1/focus-edge.ps1", source: script });
			}
		}
	]
};

export default config;
