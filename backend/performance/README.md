# Reproducible reporting query study

Measured November 16, 2026 against the local PostgreSQL 17 container. `study.sql` creates 100,000 synthetic rows in a session-local temporary table, runs the same seven-day tenant/owner aggregation before and after a partial index, then rolls back. Application records and indexes are unchanged.

| Scenario | Execution time (one sample) | Plan nodes |
|---|---:|---|
| Without index | 6.647 ms | Aggregate, Sort, Seq Scan |
| With partial index | 0.311 ms | Aggregate, Sort, Bitmap Heap Scan, Bitmap Index Scan |

These are local observations, not production benchmarks or promised speedups. Cache state, statistics, hardware and selectivity affect timings. The useful evidence is the explain plan and reproducible comparison. Test other ranges and data distributions before adopting an index.

Run from the repository root with the synthetic Docker database running:

```powershell
Get-Content backend/performance/study.sql -Raw | docker exec -i cody-portfolio-demo-postgres-1 psql -U demo -d reporting -v ON_ERROR_STOP=1 -t -A
```

Raw EXPLAIN ANALYZE/BUFFERS JSON is in `without-index.json` and `with-index.json`. The partial index matches approved records and tenant/date filtering; owner filtering still applies. A sequential scan may be preferable for broad ranges. SQL Server/T-SQL query-plan evidence is not included in this study.
