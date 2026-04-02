import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('real_errors');
const rateLimitRate = new Rate('rate_limit_hits');

const BASE_URL = 'http://localhost:3000/api';

export const options = {
  stages: [
    { duration: '20s', target: 50 },    // warm up
    { duration: '30s', target: 200 },   // moderate load
    { duration: '30s', target: 500 },   // breaking point
    { duration: '20s', target: 0 },     // cool down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'],   // p95 latency < 1000ms (calibrated for 500 VU spikes)
    'real_errors':       ['rate<0.001'],   // Strictly 0% (500s)
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/users`, {
    headers: { Authorization: `Bearer ${__ENV.TOKEN}` },
    timeout: '5s',
  });

  check(res, {
    'status is 200 or 429': (r) => [200, 429].includes(r.status),
    'not 500': (r) => r.status < 500,
  });

  errorRate.add(res.status >= 500 || res.status === 0);
  rateLimitRate.add(res.status === 429);

  sleep(0.2);
}
