// generateStatus.js
import fs from 'fs';
import fetch from 'node-fetch';

const servers = [
  { name: 'Servidor Fagor', url: 'https://www.fagorhealthcare.com/FMD/update.ini' },
  { name: 'Servidor Github', url: 'https://raw.githubusercontent.com/MedicalDispenser/FMD_BETA/main/update.ini' },
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

function statusClass(status) {
  if (status === 'online') return 'ok';
  if (status === 'error') return 'warn';
  return 'down';
}

async function generateHTML() {
  const timestamp = new Date().toISOString();
  const statuses = [];

  for (const server of servers) {
    const status = await checkServer(server.url);
    statuses.push({ name: server.name, status });
  }

  // actualizar historial
  const history = loadHistory();
  history.push({ timestamp, statuses });
  saveHistory(history);

  // generar HTML
  let content = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Estado de Servidores</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #f9f9f9; }
    table { margin: 2rem auto; width: 60%; border-collapse: collapse; }
    td, th { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
    .ok { color: green; font-weight: bold; }
    .warn { color: orange; font-weight: bold; }
    .down { color: red; font-weight: bold; }
    canvas { max-width: 90%; margin: 0 auto; display: block; }
  </style>
</head>
<body>
  <h1>Estado de Servidores</h1>
  <table>
    <thead><tr><th>Servidor</th><th>Estado</th></tr></thead><tbody>
`;

  for (const s of statuses) {
    content += `<tr><td>${s.name}</td><td class="${statusClass(s.status)}">${s.status}</td></tr>`;
  }

  content += `
    </tbody>
  </table>

  <h2>Historial de uptime</h2>
  <canvas id="uptimeChart"></canvas>

  <script>
    const history = ${JSON.stringify(history)};
    const servers = ${JSON.stringify(servers.map(s => s.name))};

    const labels = history.map(h => new Date(h.timestamp).toLocaleString());
    const datasets = servers.map(name => {
      return {
        label: name,
        data: history.map(entry => {
          const found = entry.statuses.find(s => s.name === name);
          if (!found) return null;
          return found.status === 'online' ? 1 : 0;
        }),
        fill: false,
        borderColor: name === 'Servidor Principal' ? 'green' : 'blue',
        tension: 0.1
      };
    });

    new Chart(document.getElementById('uptimeChart'), {
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
            beginAtZero: true,
            max: 1
          }
        }
      }
    });
  </script>

  <p>Última actualización: ${new Date().toLocaleString()}</p>
</body>
</html>`;
  fs.writeFileSync('docs/index.html', content);
  console.log('HTML actualizado');
}

generateHTML();