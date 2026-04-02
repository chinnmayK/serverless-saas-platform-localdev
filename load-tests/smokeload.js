import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('real_errors');
const rateLimitRate = new Rate('rate_limit_hits');

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // ramp up to 20 users
    { duration: '1m', target: 20 },  // stay at 20 users
    { duration: '20s', target: 0 },  // ramp down to 0 users
  ],
  thresholds: {
    'http_req_failed':   ['rate<0.01'],    // <1% errors
    'http_req_duration': ['p(95)<200'],    // p95 latency < 200ms
    'real_errors':       ['rate<0.01'],    // Custom metric for 500s
  },
};

const BASE_URL = 'http://localhost:3000/api';
const TOKEN = __ENV.TOKEN;

export default function () {
  const params = {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  const res = http.get(`${BASE_URL}/billing/usage`, params);
  
  check(res, {
    'status 200': (r) => r.status === 200,
    'rate limited': (r) => r.status === 429,
    'has usage data': (r) => r.status === 200 ? r.body.includes('total_requests') : true,
  });

  errorRate.add(res.status >= 500 || res.status === 0);
  rateLimitRate.add(res.status === 429);

  sleep(1);
}
