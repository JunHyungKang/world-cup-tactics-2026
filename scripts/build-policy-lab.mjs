import { buildPolicyLabRelease } from "./lib/policy-lab-release.mjs";

const outputIndex = process.argv.indexOf("--output");
const outputRoot = outputIndex >= 0 ? process.argv[outputIndex + 1] : "dist-policy-lab";
if (!outputRoot || outputRoot.startsWith("-")) throw new Error("--output requires a directory");
const result = await buildPolicyLabRelease({ outputRoot });
console.log(`[PASS] Policy Lab candidate release: ${result.outputRoot} manifest=${result.manifestSha256}`);
