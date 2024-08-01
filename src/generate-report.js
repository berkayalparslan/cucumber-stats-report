const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

let options = {}

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

function logInConsole(text, isError = true) {
  if (!options.shouldShowOutput) return;
  const logMethod = isError ? console.error : console.log;
  logMethod(text);
}

function generateStatsReport(reportOptions) {
  const statsData = new StatsData();
  options = reportOptions;
  logInConsole("started collecting stats.");
  collectStatsFromReportFiles(options.jsonReportsDir, statsData);
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
  const filePath = path.join(options.outputDir, `stats_${timestamp}.html`);

  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir);
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
    featureData.number = featureIndex+1;
    const featureCells = parseDataIntoCells(featureData);
    featureRow = buildRow([
      featureCells.name,
      emptyCell,
      emptyCell,
      featureCells.successRate,
      featureCells.count,
      featureCells.tags,
    ]);
    rows.push(featureRow);

    Object.keys(featureData.elements).map((element, elementIndex) => {
      const elementData = featureData.getElement(element);
      let elementRow = createHtmlElement("tr", "innerText", "number");
      elementData.number = elementIndex+1;
      const elementCells = parseDataIntoCells(elementData);
      elementRow = buildRow([
        featureCells.name,
        elementCells.name,
        emptyCell,
        elementCells.successRate,
        elementCells.count,
        elementCells.tags,
      ]);
      rows.push(elementRow);

      Object.keys(elementData.steps).map((step, stepIndex) => {
        const stepData = elementData.getStep(step);
        let stepRow = createHtmlElement("tr", "innerText", "number");
        stepData.number = stepIndex+1;
        stepData.name = stepData.stepId;
      const stepCells = parseDataIntoCells(stepData);
        
        stepRow = buildRow([
          featureCells.name,
          elementCells.name,
          stepCells.name,
          stepCells.successRate,
          stepCells.count,
          emptyCell,
        ]);
        rows.push(stepRow);
      });
    });
  });
  return rows.join("");
}

function parseDataIntoCells(data){
  const name = createHtmlElement('td', data.number + ' - ' + data.name, 'string');
  const successRate = createHtmlElement(
    "td",
    data.successRateInPercent,
    "number"
  );    
  const count = createHtmlElement("td", data.count, "number");
  const tags = createHtmlElement(
    "td",
    createBadges(data.tags)
  );
  return {name, successRate, count, tags};
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
  return (tags && tags.map((tag) => createBadge(tag.name)).join(",")) || "-";
}

function createBadge(text) {
  return `<span class="">${text}</span>`;
}

module.exports = {
  generateStatsReport,
};
