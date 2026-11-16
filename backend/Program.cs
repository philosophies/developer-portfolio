using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Npgsql;
using Reporting;

var builder = WebApplication.CreateBuilder(args);
var connection = builder.Configuration.GetConnectionString("Reporting") ?? throw new InvalidOperationException("Set ConnectionStrings__Reporting");
if (args.Contains("--migrate"))
{
    await MigrationRunner.ApplyAsync(connection, Path.Combine(builder.Environment.ContentRootPath, "sql"));
    return;
}
builder.Services.AddProblemDetails();
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 65536);
builder.Services.Configure<Microsoft.AspNetCore.Routing.RouteHandlerOptions>(options => options.ThrowOnBadRequest = false);
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow);
builder.Services.AddSingleton(NpgsqlDataSource.Create(connection));
builder.Services.AddScoped<RecordStore>();
var authority = builder.Configuration["Authentication:Schemes:Bearer:Authority"];
var audience = builder.Configuration["Authentication:Schemes:Bearer:Audience"];
if (!builder.Environment.IsDevelopment() && !builder.Environment.IsEnvironment("Testing") &&
    (!Uri.TryCreate(authority, UriKind.Absolute, out var uri) || uri.Scheme != "https" || string.IsNullOrWhiteSpace(audience)))
    throw new InvalidOperationException("Production requires an HTTPS OIDC authority and API audience");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters.NameClaimType = "sub";
    options.TokenValidationParameters.RoleClaimType = "role";
    options.TokenValidationParameters.ClockSkew = TimeSpan.FromSeconds(30);
});
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("records", policy => policy.RequireAuthenticatedUser().RequireRole("operator", "reviewer").RequireAssertion(c => Actor.TryCreate(c.User) is not null));
    options.AddPolicy("reviewer", policy => policy.RequireAuthenticatedUser().RequireRole("reviewer").RequireAssertion(c => Actor.TryCreate(c.User) is not null));
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("api", context => RateLimitPartition.GetFixedWindowLimiter(
        context.User.FindFirst("tenant_id")?.Value + ":" + context.User.FindFirst("sub")?.Value,
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
var app = builder.Build();
app.UseExceptionHandler();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapGet("/health", () => Results.Ok(new { status = "running", data = "synthetic" }));
app.MapGet("/health/ready", async (NpgsqlDataSource db, CancellationToken ct) =>
{
    try
    {
        await using var cmd = db.CreateCommand("SELECT EXISTS(SELECT 1 FROM reporting.schema_migrations WHERE name='002-record-workflow.sql') AND to_regclass('reporting.records') IS NOT NULL AND to_regclass('reporting.audit_log') IS NOT NULL");
        if (await cmd.ExecuteScalarAsync(ct) is not true) return Results.StatusCode(503);
        return Results.Ok(new
        {
            status = "ready"
        });
    }
    catch (NpgsqlException) { return Results.StatusCode(503); }
});
var api = app.MapGroup("/api").RequireAuthorization("records").RequireRateLimiting("api");
api.MapGet("/reports", async (DateOnly? from, DateOnly? to, int? limit, System.Security.Claims.ClaimsPrincipal user, RecordStore store, CancellationToken ct) =>
{
    var start = from ?? new DateOnly(2026, 1, 1);
    var end = to ?? new DateOnly(2026, 12, 31);
    var size = limit ?? 50;
    if (start > end || size < 1 || size > 100)
        return Results.BadRequest(new
        {
            error = "Require from <= to and limit between 1 and 100"
        });
    return Results.Ok(new
    {
        source = "synthetic",
        from = start,
        to = end,
        rows = await store.Report(Actor.TryCreate(user)!, start, end, size, ct)
    });
});
api.MapGet("/records", async (int? afterId, int? limit, System.Security.Claims.ClaimsPrincipal user, RecordStore store, CancellationToken ct) =>
{
    var size = limit ?? 50;
    if (size < 1 || size > 100 || afterId < 0)
        return Results.BadRequest(new
        {
            error = "Invalid cursor or limit"
        });
    var records = await store.List(Actor.TryCreate(user)!, afterId ?? 0, size + 1, ct);
    var next = records.Count > size ? records[size - 1].Id : (int?)null;
    return Results.Ok(new
    {
        items = records.Take(size),
        nextAfterId = next
    });
});
api.MapGet("/records/{id:int}", async (int id, System.Security.Claims.ClaimsPrincipal user, RecordStore store, CancellationToken ct) =>
    await store.Get(Actor.TryCreate(user)!, id, ct) is { } record ? Results.Ok(record) : Results.NotFound());
api.MapGet("/records/{id:int}/history", async (int id, System.Security.Claims.ClaimsPrincipal user, RecordStore store, CancellationToken ct) =>
    await store.Get(Actor.TryCreate(user)!, id, ct) is null ? Results.NotFound() : Results.Ok(await store.History(Actor.TryCreate(user)!, id, ct)));
api.MapPost("/records", async (CreateRecord input, System.Security.Claims.ClaimsPrincipal user, RecordStore store, CancellationToken ct) =>
{
    if (!Rules.Valid(input.ExternalId, input.Department, input.OccurredOn, input.Amount, input.Status))
        return Results.BadRequest(new
        {
            error = "Invalid record fields"
        });
    var result = await store.Create(Actor.TryCreate(user)!, input, ct);
    return result.Error is null ? Results.Created($"/api/records/{result.Record!.Id}", result.Record) : Results.Conflict(new
    {
        error = result.Error
    });
});
api.MapPost("/records/{id:int}/submit", async (int id, VersionRequest input, System.Security.Claims.ClaimsPrincipal user, RecordStore store, CancellationToken ct) =>
    Rules.ToResult(await store.Change(Actor.TryCreate(user)!, id, input.ExpectedVersion, "submit", null, null, ct)));
api.MapPost("/records/{id:int}/review", async (int id, ReviewRequest input, System.Security.Claims.ClaimsPrincipal user, RecordStore store, CancellationToken ct) =>
{
    if (!Rules.ValidReason(input.Reason))
        return Results.BadRequest(new
        {
            error = "Review reason must contain 3–500 characters"
        });
    return Rules.ToResult(await store.Change(Actor.TryCreate(user)!, id, input.ExpectedVersion, input.Approve ? "approve" : "reject", input.Reason, null, ct));
}).RequireAuthorization("reviewer");
api.MapPost("/records/{id:int}/corrections", async (int id, CorrectRecord input, System.Security.Claims.ClaimsPrincipal user, RecordStore store, CancellationToken ct) =>
{
    if (!Rules.Valid("correction", input.Department, input.OccurredOn, input.Amount, input.Status) || !Rules.ValidReason(input.Reason))
        return Results.BadRequest(new
        {
            error = "Invalid correction fields or reason"
        });
    return Rules.ToResult(await store.Change(Actor.TryCreate(user)!, id, input.ExpectedVersion, "correct", input.Reason, input, ct));
});
app.Run();
public partial class Program
{
}
