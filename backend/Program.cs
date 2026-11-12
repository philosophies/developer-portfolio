using Npgsql;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddProblemDetails();
builder.Services.Configure<Microsoft.AspNetCore.Routing.RouteHandlerOptions>(options => options.ThrowOnBadRequest = false);
builder.Services.AddSingleton(_ => NpgsqlDataSource.Create(builder.Configuration.GetConnectionString("Reporting") ?? throw new InvalidOperationException("Set ConnectionStrings__Reporting")));
var app = builder.Build();
app.UseExceptionHandler();
app.MapGet("/health", () => Results.Ok(new { status = "running", data = "synthetic" }));
app.MapGet("/api/reports", async (DateOnly? from, DateOnly? to, int? limit, NpgsqlDataSource db, CancellationToken ct) => {
    var start = from ?? new DateOnly(2026, 1, 1);
    var end = to ?? new DateOnly(2026, 12, 31);
    var size = limit ?? 50;
    if (start > end || size < 1 || size > 100) return Results.BadRequest(new { error = "Require from <= to and limit between 1 and 100" });
    await using var cmd = db.CreateCommand("SELECT department, count(*) AS records, sum(amount) AS total, count(*) FILTER (WHERE status = 'exception') AS exceptions FROM reporting.entries WHERE occurred_on BETWEEN $1 AND $2 GROUP BY department ORDER BY department LIMIT $3");
    cmd.Parameters.AddWithValue(start); cmd.Parameters.AddWithValue(end); cmd.Parameters.AddWithValue(size);
    var rows = new List<Report>();
    await using var reader = await cmd.ExecuteReaderAsync(ct);
    while (await reader.ReadAsync(ct)) rows.Add(new(reader.GetString(0), reader.GetInt64(1), reader.GetDecimal(2), reader.GetInt64(3)));
    return Results.Ok(new { source = "synthetic", from = start, to = end, rows });
});
app.Run();
public record Report(string Department, long Records, decimal Total, long Exceptions);
public partial class Program { }
