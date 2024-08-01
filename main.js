const fs = require("fs");
const {generateStatsReport} = require('./src/generate-report');


const args = process.argv.slice(2);
console.log(args);
const jsonDirFlagIndex = args.findIndex((arg) => arg === "--jsonDir");
const jsonDirFlagGiven = jsonDirFlagIndex !== -1;
const jsonReportsDir = jsonDirFlagGiven
  ? args[jsonDirFlagIndex++]
  : "./reports/";
const shouldShowOutput = args.includes("--showOutput");
const shouldGenerateStatsReport = !args.includes("--no-generate");
const outputDirFlagIndex = args.findIndex((arg) => arg === "--outputDir");
const isOutputFlagSet = outputDirFlagIndex !== -1;
const outputDir = isOutputFlagSet ? outputDirFlagIndex + 1 : "./reports/stats/";

generateStatsReport({
    jsonReportsDir: jsonReportsDir,
    shouldShowOutput: shouldShowOutput,
    shouldGenerateStatsReport: shouldGenerateStatsReport,
    outputDir: outputDir
});