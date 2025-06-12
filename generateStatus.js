// generateStatus.js
import fs from 'fs';
import fetch from 'node-fetch';

const servers = [
  { name: 'Servidor Fagor', url: 'https://www.fagorhealthcare.com/FMD/update.ini' },
  { name: 'Servidor Github', url: 'https://raw.githubusercontent.com/MedicalDispenser/FMD_BETA/main/update.ini' },
];

async function checkServer(url) {
  try {
    const response = await fetch(url, { timeout: 5000 });
    return response.ok ? '✅ En línea' : '⚠️ Error';
  } catch (err) {
    return '❌ Fuera de línea';
  }
}

async function generateHTML() {
  let content = `<html><head><title>Estado de servidores</title></head><body><h1>Estado de servidores</h1><ul>`;
  
  for (const server of servers) {
    const status = await checkServer(server.url);
    content += `<li><strong>${server.name}</strong>: ${status}</li>`;
  }

  content += `</ul><p>Última actualización: ${new Date().toLocaleString()}</p></body></html>`;

  fs.writeFileSync('docs/index.html', content);
  console.log('Archivo HTML generado en docs/index.html');
}

generateHTML();
