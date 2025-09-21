# Load Testing Guide for Teacher Rank

## Setup

1. Install dependencies:
```bash
pip install -r requirements-test.txt
```

## Quick Start

### Linux/Mac:
```bash
./run_load_test.sh
```

### Windows:
```cmd
run_load_test.bat
```

## Test Scenarios

The load test simulates 4 types of users:

1. **Regular Users (60%)**: Browse, search, view profiles, submit ratings
2. **Mobile Users (30%)**: Quick searches, top-rated browsing
3. **Admin Users (10%)**: Dashboard, management tasks
4. **Stress Test Users**: Aggressive testing patterns

## Running Tests

### 1. Web UI Mode (Interactive)
```bash
locust -f locustfile.py --host=http://localhost:5173
```
Access at: http://localhost:8089

### 2. Headless Mode (CI/CD)
```bash
locust -f locustfile.py --host=http://localhost:5173 --users=100 --spawn-rate=10 --run-time=5m --headless
```

### 3. Using Config File
```bash
locust -f locustfile.py --config=locust.conf
```

## Test Profiles

- **Quick Test**: 50 users, 1 minute
- **Stress Test**: 500 users, 2 minutes  
- **Production Test**: 100 users, 10 minutes
- **Custom**: Configure your own parameters

## Results

Results are saved in the `results/` folder:
- CSV files with detailed metrics
- HTML reports with visualizations

## Metrics to Monitor

- **Response Times**: p50, p95, p99
- **RPS**: Requests per second
- **Failure Rate**: Should be < 1%
- **CPU/Memory**: Monitor server resources

## Interpreting Results

- **Good**: p95 < 1s, failure rate < 0.1%
- **Acceptable**: p95 < 3s, failure rate < 1%
- **Poor**: p95 > 3s, failure rate > 1%

## API Endpoints Tested

- `GET /` - Homepage
- `GET /api/teachers` - Teacher list
- `GET /api/teachers?search=` - Search
- `GET /api/teachers/{id}` - Teacher profile
- `POST /api/ratings` - Submit rating
- `POST /api/teacher-requests` - Teacher request
- `GET /api/stats` - Statistics
- Admin endpoints (with auth)