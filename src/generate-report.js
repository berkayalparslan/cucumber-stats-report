const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

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

class StatsData {
  features = {};
  createdDate;

  constructor() {
    this.createdDate = new Date();
  }

  getFeature(featureId) {
    if (!this.features[featureId]) {
      this.features[featureId] = new FeatureStats(featureId);
    }
    return this.features[featureId];
  }
  getElement(featureId, elementId) {
    const feature = this.getFeature(featureId);

    if (!feature.elements[elementId]) {
      feature.elements[elementId] = new ElementStats(featureId, elementId);
    }
    return feature.elements[elementId];
  }
}

class FeatureStats {
  count = 0;
  name = "";
  elements = {};
  tags = [];
  results = [];
  successRateInPercent = 0;
  featureId;

  constructor(featureId) {
    this.featureId = featureId;
  }

  getElement(elementId) {
    if (!this.elements[elementId]) {
      this.elements[elementId] = new ElementStats(this.featureId, elementId);
    }
    return this.elements[elementId];
  }

  incrementCount() {
    this.count++;
  }
  setNameAndTags(name, tags) {
    this.name = name;
    this.tags = tags;
  }

  processFeatureElements(elements) {
    let scenarioTotalDuration = 0;
    let isAnyElementFailed = false;
    let scenarioStatus = "";

    elements.forEach((element) => {
      const elementStats = this.getElement(element.id);
      const stepsTotalDuration = element.steps.reduce(
        (sum, currentStep) => sum + currentStep.result.duration,
        0
      );
      const isAnyStepFailed = element.steps.find(
        (step) => step.result.status === "failed"
      );
      const elementStatus = isAnyStepFailed ? "failed" : "passed";
      isAnyElementFailed = isAnyStepFailed;
      elementStats.results.push({
        duration: stepsTotalDuration,
        status: elementStatus,
      });
      scenarioStatus = isAnyElementFailed ? "failed" : "passed";

      elementStats.incrementCount();
      elementStats.setNameAndTags(element.name, element.tags);

      scenarioTotalDuration += stepsTotalDuration;
      this.addNewResult({
        duration: scenarioTotalDuration,
        status: scenarioStatus,
      });
      elementStats.procesSteps(element.steps);
    });
  }
  addNewResult(result) {
    this.results.push(result);
  }

  updateSuccessRate() {
    const passedCount = this.results.filter(
      (result) => result.status === "passed"
    ).length;
    const stepCount = this.count;
    this.successRateInPercent = ((passedCount / stepCount) * 100.0).toFixed(2);
  }
}

class ElementStats {
  count = 0;
  name = "";
  steps = {};
  tags = [];
  results = [];
  successRateInPercent = 0;
  featureId;
  elementId;
  constructor(featureId, elementId) {
    this.featureId = featureId;
    this.elementId = elementId;
  }

  getStep(stepId) {
    if (!this.steps[stepId]) {
      this.steps[stepId] = new StepStats(
        this.featureId,
        this.elementId,
        stepId
      );
    }
    return this.steps[stepId];
  }

  incrementCount() {
    this.count++;
  }
  setNameAndTags(name, tags) {
    this.name = name;
    this.tags = tags;
  }

  procesSteps(steps) {
    steps.forEach((step) => {
      const stepId = step.keyword + (step.name ?? "");
      const stepStats = this.getStep(stepId);
      stepStats.incrementCount();
      stepStats.addNewResult(step.result);
      stepStats.updateSuccessRate();
    });
  }

  updateSuccessRate() {
    const passedCount = this.results.filter(
      (result) => result.status === "passed"
    ).length;
    const stepCount = this.count;
    this.successRateInPercent = ((passedCount / stepCount) * 100.0).toFixed(2);
  }
}

class StepStats {
  count = 0;
  results = [];
  successRateInPercent = 0;

  constructor(featureId, elementId, stepId) {
    this.featureId = featureId;
    this.elementId = elementId;
    this.stepId = stepId;
  }

  incrementCount() {
    this.count++;
  }

  addNewResult(result) {
    this.results.push(result);
  }
  updateSuccessRate() {
    const passedCount = this.results.filter(
      (result) => result.status === "passed"
    ).length;
    const stepCount = this.count;
    this.successRateInPercent = ((passedCount / stepCount) * 100.0).toFixed(2);
  }
}

if (shouldGenerateStatsReport) {
  generateStatsReport();
}

function logInConsole(text, isError = true) {
  if (!shouldShowOutput) return;
  const logMethod = isError ? console.error : console.log;
  logMethod(text);
}

function generateStatsReport() {
  const statsData = new StatsData();
  logInConsole("started collecting stats.");
  collectStatsFromReportFiles(jsonReportsDir, statsData);
  logInConsole("finished collecting stats. Generating HTML report...");
  const htmlStatsReportPath = generateHTMLStatsReport(statsData);
  execSync(`open-cli ${htmlStatsReportPath}`);
}

function collectStatsFromReportFiles(reportFilesPath, statsData) {
  const regex = new RegExp(".*json");
  const files = fs
    .readdirSync(reportFilesPath)
    .filter((file) => regex.test(file));
  logInConsole(`found ${files.length} report files in ${reportFilesPath}.`);

  for (const reportFile of files) {
    try {
      logInConsole("started collecting stats from file: " + reportFile);
      const json = JSON.parse(
        fs.readFileSync(path.join(reportFilesPath, reportFile), "utf-8")
      );
      collectStatsFromReportFile(json, statsData);
    } catch (error) {
      logInConsole("error occurred. Can't collect stats from this file.");
      logInConsole(error.message);
    } finally {
      continue;
    }
  }
  logInConsole("finished collecting stats from file.", false);
}

function collectStatsFromReportFile(features, statsData) {
  features.forEach((feature) => {
    const featureStats = statsData.getFeature(feature.id);
    featureStats.incrementCount();
    featureStats.setNameAndTags(feature.name, feature.tags);
    featureStats.processFeatureElements(feature.elements);
  });
}

function generateHTMLStatsReport(statsData) {
  const html = buildHTML(statsData);
  const timestamp = new Date().toISOString().split(".")[0].replaceAll(":", "");
  const filePath = path.join(outputDir, `stats_${timestamp}.html`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  fs.writeFileSync(filePath, html, "utf-8");
  return filePath;
}

function buildHTML(statsData) {
  const htmlTemplate = fs.readFileSync("./src/template.html", "utf-8");
  const reportDate = new Date().toLocaleString();
  const rows = prepareRows(statsData);
  let finalHtml = htmlTemplate;
  finalHtml = finalHtml.replace("{REPORT_DATE}", reportDate);
  finalHtml = finalHtml.replace("{ROWS}", rows);
  return finalHtml;
}

function prepareRows(statsData) {
  let rows = [];
  Object.keys(statsData.features).map((feature, featureIndex) => {
    const featureData = statsData.getFeature(feature);
    const emptyCell = createHtmlElement("td", "-");

    let featureRow = createHtmlElement("tr", "{ROW}");
    const featureName = createHtmlElement(
      "td",
      featureIndex + 1 + " - " + featureData.name,
      "string"
    );
    const featureSuccessRate = createHtmlElement(
      "td",
      featureData.successRateInPercent,
      "number"
    );
    const featureCount = createHtmlElement("td", featureData.count, "number");
    const featureTags = createHtmlElement(
      "td",
      createBadges(featureData.tags)
    );
    featureRow = buildRow([
      featureName,
      emptyCell,
      emptyCell,
      featureSuccessRate,
      featureCount,
      featureTags,
    ]);
    rows.push(featureRow);

    Object.keys(featureData.elements).map((element, elementIndex) => {
      const elementData = featureData.getElement(element);
      let elementRow = createHtmlElement("tr", "innerText", "number");
      const elementName = createHtmlElement("td", (elementIndex+1) + ' - ' + elementData.name, "string");
      const elementSuccessRate = createHtmlElement(
        "td",
        elementData.successRateInPercent,
        "number"
      );
      const elementCount = createHtmlElement("td", elementData.count, "number");
      const elementTags = createHtmlElement(
        "td",
        createBadges(elementData.tags)
      );
      elementRow = buildRow([
        featureName,
        elementName,
        emptyCell,
        elementSuccessRate,
        elementCount,
        elementTags,
      ]);
      rows.push(elementRow);

      Object.keys(elementData.steps).map((step, stepIndex) => {
        const stepData = elementData.getStep(step);
        let stepRow = createHtmlElement("tr", "innerText", "number");
        const stepName = createHtmlElement(
          "td",
          stepIndex + 1 + " - " + step,
          "string"
        );
        const stepSuccessRate = createHtmlElement(
          "td",
          stepData.successRateInPercent,
          "number"
        );
        const stepCount = createHtmlElement("td", stepData.count, "number");
        stepRow = stepRow.replace(
          "innerText",
          featureName +
            elementName +
            stepName +
            stepSuccessRate +
            stepCount +
            emptyCell
        );
        rows.push(stepRow);
      });
    });
  });
  return rows.join("");
}

function buildRow(cells) {
  let rowTemplate = createHtmlElement("tr", "{ROW}");
  const row = rowTemplate.replace("{ROW}", cells.join(""));
  return row;
}

function createHtmlElement(element, text, dataType) {
  return `<${element} ${
    dataType ? `data-type="${dataType}"` : ""
  }>${text}</${element}>`;
}

function createBadges(tags) {
  return (tags && tags.map((tag) => createBadge(tag.name)).join("")) || "-";
}

function createBadge(text) {
  return `<span class="badge badge-primary">${text}</span>`;
}

module.exports = {
  generateStatsReport,
};
