const fs = require('fs');
const readline = require('readline');

async function analyze(filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const durations = [];
  const statusCodes = {};
  
  // To identify degradation, we'll track avg latency in windows
  const WINDOW_SIZE = 5000; // 5k requests
  const latencyWindows = [];
  let currentWindow = [];

  for await (const line of rl) {
    try {
      const d = JSON.parse(line);
      if (d.type === 'Point' && d.metric === 'http_req_duration') {
        const val = d.data.value;
        durations.push(val);
        currentWindow.push(val);
        
        if (currentWindow.length >= WINDOW_SIZE) {
          const avg = currentWindow.reduce((a, b) => a + b, 0) / WINDOW_SIZE;
          latencyWindows.push(avg);
          currentWindow = [];
        }
      }
      if (d.type === 'Point' && d.metric === 'http_req_status') {
        // Not all schemas have http_req_status, check k6 schema
      }
    } catch (e) {}
  }

  durations.sort((a, b) => a - b);
  
  console.log('--- Performance Analysis ---');
  console.log(`Total Requests Analyzed: ${durations.length}`);
  console.log(`p50: ${durations[Math.floor(durations.length * 0.5)].toFixed(2)}ms`);
  console.log(`p95: ${durations[Math.floor(durations.length * 0.95)].toFixed(2)}ms`);
  console.log(`p99: ${durations[Math.floor(durations.length * 0.99)].toFixed(2)}ms`);
  console.log('Worst 20 response times (ms):');
  console.log(durations.slice(-20).join('\n'));
  
  if (latencyWindows.length > 1) {
    console.log('\n--- Latency Drift (Avg per 5000 reqs) ---');
    latencyWindows.forEach((avg, i) => {
      console.log(`Window ${i+1}: ${avg.toFixed(2)}ms`);
    });
    const first = latencyWindows[0];
    const last = latencyWindows[latencyWindows.length - 1];
    const drift = ((last - first) / first) * 100;
    console.log(`Degradation: ${drift > 0 ? '+' : ''}${drift.toFixed(2)}%`);
  }
}

const targetFile = process.argv[2] || 'results/long-duration.json';
analyze(targetFile).catch(err => console.error(err));
