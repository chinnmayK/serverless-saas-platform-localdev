import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('real_errors');
const successRate = new Rate('success_total');

export const options = {
  vus: 50,
  duration: '1m',
  thresholds: {
    'http_req_duration': ['p(95)<200'],    // p95 latency < 200ms
    'success_total':     ['rate>=0.95'],   // >95% success
    'real_errors':       ['rate<0.001'],   // Strictly 0% (500s)
  },
};

const BASE_URL = 'http://localhost:3000/api';

export default function () {
  const res = http.get(`${BASE_URL}/users`, {
    headers: { Authorization: `Bearer ${__ENV.TOKEN}` },
  });

  check(res, {
    'status is 200 or 429': (r) => [200, 429].includes(r.status),
    'not 500': (r) => r.status < 500,
  });

  successRate.add(res.status === 200);
  errorRate.add(res.status >= 500 || res.status === 0);

  sleep(1);
}
