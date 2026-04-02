import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('real_errors');
const rateLimitRate = new Rate('rate_limit_hits');

const BASE_URL = 'http://localhost:3000/api';
const HEADERS  = { Authorization: `Bearer ${__ENV.TOKEN}` };

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp up
    { duration: '2m', target: 100 }, // Sustained load
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    'http_req_failed':   ['rate<0.01'],    // <1% errors
    'http_req_duration': ['p(95)<200'],    // p95 latency < 200ms
    'real_errors':       ['rate<0.1'],     // Custom metric for 500s (chaos tolerance)
  },
};

export default function () {
  const endpoints = ['/users', '/billing/usage', '/dashboard/files'];
  const path = endpoints[Math.floor(Math.random() * endpoints.length)];

  const res = http.get(`${BASE_URL}${path}`, { headers: HEADERS, timeout: '6s' });

  check(res, {
    'status 200': (r) => r.status === 200,
    'rate limited': (r) => r.status === 429,
    'status 503 (expected chaos)': (r) => r.status === 503,
  });

  errorRate.add(res.status >= 500 && res.status !== 503); // 503 is expected in chaos
  rateLimitRate.add(res.status === 429);

  sleep(0.5);
}
