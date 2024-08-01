

function generateStatsReport(reportsDir, outputDir) {
    const statsData = {};
    collectStatsFromReportFiles(reportsDir, statsData);
  
    console.log("finished collecting stats.");
    const htmlStatsReportPath = generateHTMLStatsReport(statsData);
    execSync(`open-cli ${htmlStatsReportPath}`);
  }

  function collectStatsFromReportFiles(reportFilesPath, statsData) {
    const regex = new RegExp("cucumber-report.*json");
    const files = fs
      .readdirSync(reportFilesPath)
      .filter((file) => regex.test(file));
    console.log(`found ${files.length} report files in ${reportFilesPath}.`);
  
    for (const reportFile of files) {
      try {
        console.log("started collecting stats from file: ", reportFile);
        const scenarios = JSON.parse(
          fs.readFileSync(path.join(reportFilesPath, reportFile), "utf-8")
        );
        collectStatsFromReportFile(scenarios, statsData);
      } catch (error) {
        console.error("error occurred. Can't collect stats from this file.");
        console.error(error.message);
      } finally {
        continue;
      }
    }
    console.log("finished collecting stats from file.");
  }

  function generateHTMLStatsReport(statsData) {
    const html = generateHTML(statsData);
    const timestamp = new Date().toISOString().split(".")[0].replaceAll(":", "");
    const statsFolderPath = "./reports/archive/stats/";
    const filePath = path.join(statsFolderPath, `stats_${timestamp}.html`);
  
    if (!fs.existsSync(statsFolderPath)) {
      fs.mkdirSync(statsFolderPath);
    }
  
    fs.writeFileSync(filePath, html, "utf-8");
    return filePath;
  }

  function generateHTML(statsData) {
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Report</title>
      <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
      <style>
          th {
              cursor: pointer;
          }
      </style>
      <script>
      document.addEventListener('DOMContentLoaded', () => {
      const table = document.querySelector('table');
      const headers = table.querySelectorAll('th');
      const tableBody = table.querySelector('tbody');
      const rows = tableBody.querySelectorAll('tr');
  
      const directions = Array.from(headers).map(() => '');
  
      // Transform the content of given cell in given column
      const transform = (index, content) => {
          // Get the data type of column
          const type = headers[index].getAttribute('data-type');
          switch (type) {
              case 'number':
                  return parseFloat(content);
              case 'string':
              default:
                  return content;
          }
      };
  
      const sortColumn = (index) => {
          // Get the current direction
          const direction = directions[index] || 'asc';
  
          // A factor based on the direction
          const multiplier = direction === 'asc' ? 1 : -1;
  
          const newRows = Array.from(rows);
          
          newRows.sort((rowA, rowB) => {
              const cellA = rowA.querySelectorAll('td')[index].innerHTML;
              const cellB = rowB.querySelectorAll('td')[index].innerHTML;
  
              const a = transform(index, cellA);
              const b = transform(index, cellB);
  
              switch (true) {
                  case a > b: return 1 * multiplier;
                  case a < b: return -1 * multiplier;
                  case a === b: return 0;
              }
          });
  
          // Remove old rows
          [].forEach.call(rows, (row) => {
              tableBody.removeChild(row);
          });
  
          // Append new rows
          newRows.forEach((newRow) => {
              tableBody.appendChild(newRow);
          });
  
          // Reverse the direction
          directions[index] = direction === 'asc' ? 'desc' : 'asc';
      };
  
      [].forEach.call(headers, (header, index) => {
          header.addEventListener('click', () => {
              sortColumn(index);
          });
      });
  });
  
      </script>
  </head>
  <body>
      <div class="container-fluid">
          <h1 class="mt-5">Stats Report</h1>
          <p>${new Date().toISOString()}</p>
          <table class="table table-responsive table-striped">
              <thead>
                  <tr>
                      <th>Scenario</th>
                      <th>Element</th>
                      <th>Step</th>
                      <th>Success Rate</th>
                      <th>Total</th>
                      <th>Tags</th>
                  </tr>
              </thead>
              <tbody>
               ${prepareRows(statsData)}
              </tbody>
          </table>
      </div>
  </body>
  </html>
  `;
  }
  
  function prepareRows(statsData) {
    let rows = [];
    Object.keys(statsData).map((scenario, scenarioIndex) => {
      const scenarioData = statsData[scenario];
      const emptyCell = createHtmlElement("td", "-");
      let scenarioRow = createHtmlElement("tr", "innerText");
      const scenarioName = createHtmlElement(
        "td",
        scenarioIndex + 1 + " - " + scenarioData.name,
        "string"
      );
      const scenarioCount = createHtmlElement("td", scenarioData.count, "number");
      scenarioRow = scenarioRow.replace(
        "innerText",
        scenarioName + emptyCell + emptyCell + emptyCell + scenarioCount
      );
      rows.push(scenarioRow);
  
      Object.keys(scenarioData.elements).map((element, elementIndex) => {
        const elementData = scenarioData.elements[element];
        let elementRow = createHtmlElement("tr", "innerText", "number");
        const elementName = createHtmlElement("td", elementData.name, "string");
        const elementCount = createHtmlElement("td", elementData.count, "number");
        const badges = createHtmlElement("td", createBadges(elementData.tags));
        elementRow = elementRow.replace(
          "innerText",
          scenarioName +
            elementName +
            emptyCell +
            emptyCell +
            elementCount +
            badges
        );
        rows.push(elementRow);
  
        Object.keys(elementData.steps).map((step, stepIndex) => {
          const stepData = elementData.steps[step];
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
            scenarioName + elementName + stepName + stepSuccessRate + stepCount
          );
          rows.push(stepRow);
        });
      });
    });
    return rows.join("");
  }
  
  function createHtmlElement(element, text, dataType) {
    return `<${element} ${
      dataType ? `data-type="${dataType}"` : ""
    }>${text}</${element}>`;
  }
  
  function createBadges(tags) {
    return tags.map((tag) => createBadge(tag.name)).join("");
  }
  
  function createBadge(text) {
    return `<span class="badge badge-primary">${text}</span>`;
  }