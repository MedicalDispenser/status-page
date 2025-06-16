import fs from 'fs';
import fetch from 'node-fetch';

const groups = [
  {
    name: 'Servidores internos',
    servers: [
      { name: 'Fagor Healthcare', url: 'https://www.fagorhealthcare.com/FMD/update.ini' },
      { name: 'Github', url: 'https://raw.githubusercontent.com/MedicalDispenser/FMD/main/update.ini' }
    ]
  },
  {
    name: 'Servidores externos',
    servers: [
      { name: 'Farmanager v0', url: 'http://151.80.33.210:8081/Restful/' },
      { name: 'Farmanager v1', url: 'https://api.farmanager.es/' },
      { name: 'Botplus', url: 'http://actualizacion.portalfarma.com/Actualizador/WebServiceBDM.asmx' },
      { name: 'Sifarma', url: 'https://services.sifarma.pt/rest/' },
    ]
  }
];

async function checkServer(url) {
  try {
    const res = await fetch(url, { timeout: 5000 });
    if (!res.ok) {
      return { status: 'error', reason: `Código HTTP: ${res.status}` };
    }
    return { status: 'online', reason: '' };
  } catch (err) {
    return { status: 'offline', reason: err.message };
  }
}

async function fetchIncidents() {
  try {
    const res = await fetch('https://nrapi.fmd.fagorhealthcare.com/v0/serverStatus');
    const data = await res.json();
    const incidents = {};
    for (let i = 1; i < data.length; i++) {
      const [server, dateTime, type, text] = data[i];
      const [date, time] = dateTime.split(' ');
      if (!incidents[server]) incidents[server] = {};
      if (!incidents[server][date]) incidents[server][date] = [];
      incidents[server][date].push({ time, type, text });
    }
    return incidents;
  } catch (e) {
    return {};
  }
}

function statusIcon(status) {
  return status === 'online' ? '🟢' : status === 'error' ? '🟠' : '🔴';
}

function statusClass(status) {
  if (status === 'online') return 'ok';
  if (status === 'error') return 'warn';
  return 'down';
}

function loadHistory() {
  if (fs.existsSync('docs/history.json')) {
    return JSON.parse(fs.readFileSync('docs/history.json'));
  }
  return [];
}

function saveHistory(history) {
  fs.writeFileSync('docs/history.json', JSON.stringify(history, null, 2));
}

async function generateHTML() {
  const timestamp = new Date().toISOString();
  const currentStatus = [];
  const overallStatuses = [];

  for (const group of groups) {
    const statuses = [];
    for (const server of group.servers) {
      const result = await checkServer(server.url);
      statuses.push({ name: server.name, status: result.status, reason: result.reason });
      overallStatuses.push(result.status);
    }
    currentStatus.push({ group: group.name, statuses });
  }

  const overall = overallStatuses.every(s => s === 'online') ? '🟢' : '🔴';

  const history = loadHistory();
  history.push({ timestamp, groups: currentStatus });
  saveHistory(history);

  const incidents = await fetchIncidents();

  let html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Estado de Servidores</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #f9f9f9;
      color: #333;
      margin: 2rem;
    }
    h1 {
      font-size: 1.5rem;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
    }
    details {
      margin: 1rem 0;
      background: #fff;
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 1rem;
    }
    summary {
      font-weight: bold;
      cursor: pointer;
    }
    .ok { color: green; }
    .warn { color: orange; }
    .down { color: red; }
    .reason {
      font-size: 0.85rem;
      color: #999;
      margin-left: 1.5rem;
    }
    .incident-entry {
      padding: 0.25rem 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.95rem;
    }
    .incident-entry .text {
      flex: 1;
      opacity: 0.8;
    }
    .incident-entry.error .text {
      color: #c53030;
    }
    .incident-entry.solution .text {
      color: #2f855a;
    }
    ul { padding-left: 1.2rem; }
    li { margin-bottom: 0.5rem; }
    footer {
      margin-top: 2rem;
      text-align: center;
      font-size: 0.9rem;
      color: #666;
    }
  </style>
</head>
<body>
  <h1>Estado de Servidores <span>${overall}</span></h1>
`;

  for (const group of currentStatus) {
    const groupStatus = group.statuses.every(s => s.status === 'online') ? '🟢' : '🔴';
    html += `<details><summary>${group.group} - ${groupStatus}</summary><ul>`;
    for (const server of group.statuses) {
      html += `<li><details><summary>${statusIcon(server.status)} <span class="${statusClass(server.status)}">${server.name}</span>`;
      if (server.status === 'error') {
        html += `<div class="reason">(${server.reason})</div>`;
      }
      html += `</summary>`;
      const serverIncidents = incidents[server.name] || {};
      const sortedDates = Object.keys(serverIncidents).sort().reverse();
      if (sortedDates.length > 0) {
        html += '<ul>';
        for (const date of sortedDates) {
          html += `<li><strong>${date}</strong><ul>`;
          for (const incident of serverIncidents[date]) {
            const cls = incident.type.toLowerCase() === 'error' ? 'error' : 'solution';
            html += `<li class="incident-entry ${cls}"><span class="text">${incident.type} - ${incident.text}</span><span class="time">${incident.time}</span></li>`;
          }
          html += '</ul></li>';
        }
        html += '</ul>';
      } else {
        html += '<p>Sin incidencias registradas.</p>';
      }
      html += '</details></li>';
    }
    html += '</ul></details>';
  }

  html += `<footer>Última actualización: ${new Date().toLocaleString()}</footer>
</body>
</html>`;

  fs.writeFileSync('docs/index.html', html);
  console.log('HTML generado con incidencias agrupadas por días.');
}

generateHTML();

