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
    return res.ok ? 'online' : 'error';
  } catch {
    return 'offline';
  }
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

function statusIcon(status) {
  return status === 'online' ? '✅' : status === 'error' ? '⚠️' : '❌';
}

function statusClass(status) {
  if (status === 'online') return 'ok';
  if (status === 'error') return 'warn';
  return 'down';
}

async function generateHTML() {
  const timestamp = new Date().toISOString();
  const currentStatus = [];

  for (const group of groups) {
    const statuses = [];
    for (const server of group.servers) {
      const status = await checkServer(server.url);
      statuses.push({ name: server.name, status });
    }
    currentStatus.push({ group: group.name, statuses });
  }

  const history = loadHistory();
  const serverHistory = {};

  history.push({ timestamp, groups: currentStatus });
  history.forEach((entry) => {
    entry.groups.forEach((group) => {
      group.statuses.forEach((server) => {
        if (!serverHistory[server.name]) {
          serverHistory[server.name] = [];
        }
        serverHistory[server.name].push({
          time: entry.timestamp,
          status: server.status === 'online' ? 1 : 0,
        });
      });
    });
  });
  saveHistory(history);

  let html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Estado de Servidores</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: sans-serif; background: #f4f4f4; padding: 2rem; color: #333; }
    h1, h2 { text-align: center; }
    section { background: #fff; border-radius: 10px; padding: 1rem; margin-bottom: 2rem; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.75rem; border-bottom: 1px solid #ddd; }
    .ok { color: green; font-weight: bold; }
    .warn { color: orange; font-weight: bold; }
    .down { color: red; font-weight: bold; }
    canvas { max-width: 100%; margin-top: 1rem; }
    footer { text-align: center; color: #777; font-size: 0.9rem; margin-top: 2rem; }
    :root {
      --bg: #ffffff;
      --fg: #222222;
      --card-bg: #f9f9f9;
      --ok: #2ecc71;
      --warn: #f1c40f;
      --down: #e74c3c;
    }

    body.dark {
      --bg: #1e1e1e;
      --fg: #f0f0f0;
      --card-bg: #2b2b2b;
    }

    body {
      background: var(--bg);
      color: var(--fg);
      font-family: sans-serif;
      padding: 2rem;
      transition: background 0.3s, color 0.3s;
    }

    section {
      background: var(--card-bg);
      border-radius: 10px;
      padding: 1rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }

    .ok { color: var(--ok); font-weight: bold; }
    .warn { color: var(--warn); font-weight: bold; }
    .down { color: var(--down); font-weight: bold; }

  </style>
</head>
<body>
  <button id="theme-toggle" style="position: fixed; top: 1rem; right: 1rem; z-index: 1000;">🌓</button>
  <h1>Estado de Servidores</h1>
`;

  for (const group of currentStatus) {
    html += `<section><h2>${group.group}</h2><table><thead><tr><th>Servidor</th><th>Estado</th></tr></thead><tbody>`;
    for (const s of group.statuses) {
      html += `<tr><td>${s.name}</td><td class="${statusClass(s.status)}">${statusIcon(s.status)} ${s.status}</td></tr>`;
    }
    html += `</tbody></table><canvas id="chart-${group.group.replace(/\s+/g, '-')}" height="100"></canvas></section>`;
    //html += `<canvas id="chart-${s.name.replace(/\s+/g, '-')}" height="100"></canvas>`;
  }
  html += `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`;
  html += `<script>
    const serverHistory = ${JSON.stringify(serverHistory)};
    Object.entries(serverHistory).forEach(([serverName, data]) => {
      const canvas = document.getElementById('chart-' + serverName.replace(/\\s+/g, '-'));
      if (!canvas) return;

      const labels = data.map(d => new Date(d.time).toLocaleTimeString());
      const values = data.map(d => d.status);

      new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: serverName,
            data: values,
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.2)',
            fill: true,
            tension: 0.2
          }]
        },
        options: {
          scales: {
            y: {
              ticks: {
                callback: v => v === 1 ? 'Online' : 'Offline'
              },
              min: 0,
              max: 1
            }
          }
        }
      });
    });
  </script>`;
  html += `
  <footer>Última actualización: ${new Date().toLocaleString()}</footer>

  <script>
    const history = ${JSON.stringify(history)};
    const groups = ${JSON.stringify(groups.map(g => g.name))};

    groups.forEach(groupName => {
      const groupData = history.map(entry => {
        const g = entry.groups.find(grp => grp.group === groupName);
        return g ? g.statuses : [];
      });

      const serverNames = groupData[0].map(s => s.name);

      const datasets = serverNames.map(server => ({
        label: server,
        data: groupData.map(statuses => {
          const s = statuses.find(s => s.name === server);
          return s.status === 'online' ? 1 : 0;
        }),
        fill: false,
        borderColor: '#' + Math.floor(Math.random()*16777215).toString(16),
        tension: 0.1
      }));

      const labels = history.map(h => new Date(h.timestamp).toLocaleTimeString());

      new Chart(document.getElementById('chart-' + groupName.replace(/\\s+/g, '-')), {
        type: 'line',
        data: {
          labels,
          datasets
        },
        options: {
          scales: {
            y: {
              ticks: {
                callback: value => value === 1 ? 'Online' : 'Offline'
              },
              min: 0,
              max: 1
            }
          }
        }
      });
    });
  </script>
  <script>
    const toggle = document.getElementById('theme-toggle');
    const body = document.body;
    const currentTheme = localStorage.getItem('theme') || 'light';

    if (currentTheme === 'dark') {
      body.classList.add('dark');
    }

    toggle.addEventListener('click', () => {
      body.classList.toggle('dark');
      localStorage.setItem('theme', body.classList.contains('dark') ? 'dark' : 'light');
    });
  </script>

</body>
</html>
`;

  fs.writeFileSync('docs/index.html', html);
  console.log('HTML generado con agrupaciones');
}

generateHTML();
