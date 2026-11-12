# Enterprise Reporting API

AI-assisted .NET 10 / ASP.NET Core / PostgreSQL portfolio demo, using three synthetic records. Demonstrates constrained schema, idempotent seeds, parameterized aggregation, cancellation, bounded results, validation, and HTTP integration tests. This is not production or employer code.

From this directory: `docker compose up -d --wait`. Set `ConnectionStrings__Reporting` to `Host=localhost;Database=reporting;Username=demo;Password=local-demo-only`. Run `dotnet run`. Query `/api/reports?from=2026-01-01&to=2026-12-31&limit=50` using the localhost URL printed by ASP.NET. Run `dotnet test ../backend.tests/Reporting.Tests.csproj` against the seeded database. Operations totals 165.50, with one exception; Finance totals 210.25.

Read-only, local demo: no authentication, tenant isolation, pagination cursor, write operations or production deployment. Do not expose this API publicly without authentication/authorization, TLS, secret management and operational review. PostgreSQL hosting is separate from the static Cloudflare portfolio. Seeds run when PostgreSQL initializes a fresh container. Do not reuse a database containing real data.
