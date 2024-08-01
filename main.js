const fs = require("fs");
const {generateStatsReport} = require('./generate-report');

const args = process.argv.slice(2);
const isReportsDirFlagSet = args.find('--reportsDir')
const reportsDir = isReportsDirFlagSet ? (args.findIndex('--reportsDir'))+1 : './reports/';
const isOutputFlagSet = args.find('--outputDir');
const outputDir = isOutputFlagSet ? (args.findIndex('--outputDir'))+1 : './reports/stats/';

if(!fs.existsSync(reportsDir)){
    throw new Error('reports directory is not found!');
}

if(!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir);
}

generateStatsReport(reportsDir, outputDir);