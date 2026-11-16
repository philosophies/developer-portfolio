-- Session-local synthetic data only. Nothing is inserted into application tables.
BEGIN;
CREATE TEMP TABLE reporting_benchmark ON COMMIT DROP AS
SELECT i AS id,'tenant-'||(i%10) AS tenant_id,'owner-'||(i%20) AS owner_id,
       'Department-'||(i%4) AS department,DATE '2026-01-01'+(i%365) AS occurred_on,
       (i%10000)::numeric/100 AS amount,
       CASE WHEN i%10=0 THEN 'exception' ELSE 'valid' END AS status,
       'approved'::text AS workflow_state
FROM generate_series(1,100000) AS i;
ANALYZE reporting_benchmark;
EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON)
SELECT department,count(*),sum(amount),count(*) FILTER(WHERE status='exception')
FROM reporting_benchmark
WHERE tenant_id='tenant-2' AND owner_id='owner-2' AND workflow_state='approved'
  AND occurred_on BETWEEN DATE '2026-01-01' AND DATE '2026-01-07'
GROUP BY department ORDER BY department;
CREATE INDEX reporting_benchmark_filter ON reporting_benchmark(tenant_id,occurred_on,department)
WHERE workflow_state='approved';
ANALYZE reporting_benchmark;
EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON)
SELECT department,count(*),sum(amount),count(*) FILTER(WHERE status='exception')
FROM reporting_benchmark
WHERE tenant_id='tenant-2' AND owner_id='owner-2' AND workflow_state='approved'
  AND occurred_on BETWEEN DATE '2026-01-01' AND DATE '2026-01-07'
GROUP BY department ORDER BY department;
ROLLBACK;
