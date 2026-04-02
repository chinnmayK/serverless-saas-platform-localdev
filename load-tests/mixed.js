import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('real_errors');
const rateLimitRate = new Rate('rate_limit_hits');

const BASE_URL = 'http://localhost:3000/api';
const HEADERS = { Authorization: `Bearer ${__ENV.TOKEN}` };

export const options = {
  stages: [
    { duration: '20s',  target: 50  },  // ramp up
    { duration: '30s',  target: 200 },  // sustained load (aligned with checklist)
    { duration: '20s',  target: 0   },  // ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],    // p95 latency < 500ms
    'real_errors':       ['rate<0.001'],   // Strictly 0% (500s)
  },
};

export default function () {
  const endpoints = ['/users', '/dashboard/files', '/dashboard/billing'];
  const path = endpoints[Math.floor(Math.random() * endpoints.length)];

  const res = http.get(`${BASE_URL}${path}`, { headers: HEADERS });

  check(res, {
    'status is 200 or 429': (r) => [200, 429].includes(r.status),
    'not 500': (r) => r.status < 500,
  });

  errorRate.add(res.status >= 500 || res.status === 0);
  rateLimitRate.add(res.status === 429);

  sleep(1);
}
