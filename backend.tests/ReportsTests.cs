using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Npgsql;
using Reporting;
using Xunit;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public const string Issuer = "https://identity.example.test", Audience = "reporting-tests";
    static readonly SymmetricSecurityKey Key = new(Encoding.UTF8.GetBytes("synthetic-test-only-key-not-a-production-secret-01234567890123456789"));
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services => services.PostConfigure<JwtBearerOptions>("Bearer", options =>
        {
            var config = new OpenIdConnectConfiguration { Issuer = Issuer };
            config.SigningKeys.Add(Key);
            options.ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(config);
            options.TokenValidationParameters = new TokenValidationParameters { ValidateIssuer = true, ValidIssuer = Issuer, ValidateAudience = true, ValidAudience = Audience, ValidateLifetime = true, ValidateIssuerSigningKey = true, IssuerSigningKey = Key, RoleClaimType = "role", NameClaimType = "sub", ClockSkew = TimeSpan.Zero };
        }));
    }
    public string Token(string tenant = "demo-tenant", string subject = "demo-owner", string role = "operator", bool expired = false, bool badSignature = false, string issuer = Issuer, string audience = Audience, bool omitTenant = false)
    {
        var claims = new List<Claim> { new("sub", subject), new("role", role) };
        if (!omitTenant)
            claims.Add(new("tenant_id", tenant));
        var key = badSignature ? new SymmetricSecurityKey(Encoding.UTF8.GetBytes("different-synthetic-key-never-trusted-012345678901234567890123456789")) : Key;
        return new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(issuer, audience, claims, DateTime.UtcNow.AddMinutes(-10), DateTime.UtcNow.AddMinutes(expired ? -1 : 10), new SigningCredentials(key, SecurityAlgorithms.HmacSha256)));
    }
    public HttpClient Client(string tenant = "demo-tenant", string subject = "demo-owner", string role = "operator")
    {
        var c = CreateClient();
        c.DefaultRequestHeaders.Authorization = new("Bearer", Token(tenant, subject, role));
        return c;
    }
}

public class ReportsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    static string Tenant() => "test-" + Guid.NewGuid().ToString("N");
    static object Input(string? external = null, decimal amount = 12.50m) => new { externalId = external ?? Guid.NewGuid().ToString("N"), department = "Operations", occurredOn = "2026-01-10", amount, status = "valid" };
    static async Task<Entry> Entry(HttpResponseMessage response, HttpStatusCode expected = HttpStatusCode.OK)
    {
        Assert.Equal(expected, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<Entry>())!;
    }
    static async Task<Entry> Create(HttpClient c, string? external = null) => await Entry(await c.PostAsJsonAsync("/api/records", Input(external)), HttpStatusCode.Created);
    static async Task<JsonElement> Json(HttpResponseMessage r)
    {
        r.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement.Clone();
    }
    [Theory]
    [InlineData("?from=2026-02-01&to=2026-01-01")]
    [InlineData("?limit=0")]
    [InlineData("?limit=101")]
    [InlineData("?from=invalid")]
    public async Task RejectsInvalidQuery(string query)
    {
        using var c = factory.Client();
        Assert.Equal(HttpStatusCode.BadRequest, (await c.GetAsync("/api/reports" + query)).StatusCode);
    }
    [Fact]
    public async Task AggregatesSeededRecords()
    {
        using var c = factory.Client();
        var j = await Json(await c.GetAsync("/api/reports"));
        var rows = j.GetProperty("rows");
        Assert.Equal(2, rows.GetArrayLength());
        var operations = rows.EnumerateArray().Single(x => x.GetProperty("department").GetString() == "Operations");
        Assert.Equal(165.50m, operations.GetProperty("total").GetDecimal());
        Assert.Equal(1, operations.GetProperty("exceptions").GetInt64());
    }
    [Fact]
    public async Task DateFilterExcludesRecords()
    {
        using var c = factory.Client();
        Assert.Equal(0, (await Json(await c.GetAsync("/api/reports?from=2026-03-01"))).GetProperty("rows").GetArrayLength());
    }
    [Fact]
    public async Task AnonymousRequestsAreChallenged()
    {
        using var c = factory.CreateClient();
        foreach (var path in new[] { "/api/reports", "/api/records" })
        {
            var r = await c.GetAsync(path);
            Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
            Assert.Contains(r.Headers.WwwAuthenticate, x => x.Scheme == "Bearer");
        }
    }
    [Theory]
    [InlineData("expired")]
    [InlineData("signature")]
    [InlineData("issuer")]
    [InlineData("audience")]
    public async Task InvalidTokensAreRejected(string kind)
    {
        using var c = factory.CreateClient();
        c.DefaultRequestHeaders.Authorization = new("Bearer", factory.Token(expired: kind == "expired", badSignature: kind == "signature", issuer: kind == "issuer" ? "https://untrusted.test" : ApiFactory.Issuer, audience: kind == "audience" ? "other-api" : ApiFactory.Audience));
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/records")).StatusCode);
    }
    [Fact]
    public async Task MissingTenantAndUnknownRoleAreForbidden()
    {
        using var c = factory.CreateClient();
        c.DefaultRequestHeaders.Authorization = new("Bearer", factory.Token(omitTenant: true));
        Assert.Equal(HttpStatusCode.Forbidden, (await c.GetAsync("/api/records")).StatusCode);
        using var reader = factory.Client(role: "unrecognized");
        Assert.Equal(HttpStatusCode.Forbidden, (await reader.GetAsync("/api/records")).StatusCode);
    }
    [Fact]
    public async Task CompleteReviewAndCorrectionAreAudited()
    {
        var t = Tenant();
        using var owner = factory.Client(t, "owner");
        using var reviewer = factory.Client(t, "reviewer", "reviewer");
        var record = await Create(owner);
        Assert.Equal("draft", record.WorkflowState);
        Assert.Equal(0, (await Json(await owner.GetAsync("/api/reports"))).GetProperty("rows").GetArrayLength());
        record = await Entry(await owner.PostAsJsonAsync($"/api/records/{record.Id}/submit", new
        {
            expectedVersion = record.Version
        }));
        record = await Entry(await reviewer.PostAsJsonAsync($"/api/records/{record.Id}/review", new
        {
            expectedVersion = record.Version,
            approve = true,
            reason = "Verified against fixture"
        }));
        Assert.Equal("approved", record.WorkflowState);
        Assert.Equal(12.50m, (await Json(await owner.GetAsync("/api/reports"))).GetProperty("rows")[0].GetProperty("total").GetDecimal());
        record = await Entry(await owner.PostAsJsonAsync($"/api/records/{record.Id}/corrections", new
        {
            expectedVersion = record.Version,
            department = "Finance",
            occurredOn = "2026-01-10",
            amount = 15m,
            status = "exception",
            reason = "Corrected source amount"
        }));
        Assert.Equal("draft", record.WorkflowState);
        Assert.Equal(4, record.Version);
        Assert.Equal(0, (await Json(await owner.GetAsync("/api/reports"))).GetProperty("rows").GetArrayLength());
        var history = await Json(await owner.GetAsync($"/api/records/{record.Id}/history"));
        Assert.Equal(new[] { "create", "submit", "approve", "correct" }, history.EnumerateArray().Select(x => x.GetProperty("action").GetString()));
        var before = JsonDocument.Parse(history[3].GetProperty("before").GetString()!).RootElement;
        var after = JsonDocument.Parse(history[3].GetProperty("after").GetString()!).RootElement;
        Assert.Equal(12.50m, before.GetProperty("Amount").GetDecimal());
        Assert.Equal(15m, after.GetProperty("Amount").GetDecimal());
    }
    [Fact]
    public async Task OwnerAndTenantCannotBeBypassed()
    {
        var t = Tenant();
        using var owner = factory.Client(t, "owner");
        using var other = factory.Client(t, "other");
        using var foreignReviewer = factory.Client(Tenant(), "reviewer", "reviewer");
        var record = await Create(owner);
        foreach (var c in new[] { other, foreignReviewer })
        {
            Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/records/{record.Id}")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/records/{record.Id}/history")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await c.PostAsJsonAsync($"/api/records/{record.Id}/submit", new
            {
                expectedVersion = 1
            })).StatusCode);
            Assert.Equal(0, (await Json(await c.GetAsync("/api/records"))).GetProperty("items").GetArrayLength());
        }
    }
    [Fact]
    public async Task ClientCannotAssignOwnership()
    {
        using var c = factory.Client(Tenant());
        var r = await c.PostAsJsonAsync("/api/records", new
        {
            externalId = "spoof",
            department = "Ops",
            occurredOn = "2026-01-01",
            amount = 1,
            status = "valid",
            ownerId = "somebody-else",
            tenantId = "other"
        });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }
    [Fact]
    public async Task ReviewRequiresRoleAndIndependentPerson()
    {
        var t = Tenant();
        using var owner = factory.Client(t, "owner");
        using var self = factory.Client(t, "owner", "reviewer");
        var r = await Create(owner);
        await Entry(await owner.PostAsJsonAsync($"/api/records/{r.Id}/submit", new
        {
            expectedVersion = 1
        }));
        foreach (var c in new[] { owner, self })
            Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync($"/api/records/{r.Id}/review", new
            {
                expectedVersion = 2,
                approve = true,
                reason = "Attempt to self approve"
            })).StatusCode);
    }
    [Fact]
    public async Task RejectedRecordCanBeCorrectedAndResubmitted()
    {
        var t = Tenant();
        using var owner = factory.Client(t, "owner");
        using var reviewer = factory.Client(t, "reviewer", "reviewer");
        var r = await Create(owner);
        r = await Entry(await owner.PostAsJsonAsync($"/api/records/{r.Id}/submit", new
        {
            expectedVersion = 1
        }));
        r = await Entry(await reviewer.PostAsJsonAsync($"/api/records/{r.Id}/review", new
        {
            expectedVersion = r.Version,
            approve = false,
            reason = "Please verify amount"
        }));
        Assert.Equal("rejected", r.WorkflowState);
        r = await Entry(await owner.PostAsJsonAsync($"/api/records/{r.Id}/corrections", new
        {
            expectedVersion = r.Version,
            department = "Ops",
            occurredOn = "2026-01-01",
            amount = 10,
            status = "valid",
            reason = "Verified source value"
        }));
        r = await Entry(await owner.PostAsJsonAsync($"/api/records/{r.Id}/submit", new
        {
            expectedVersion = r.Version
        }));
        Assert.Equal("submitted", r.WorkflowState);
    }
    [Fact]
    public async Task InvalidTransitionAndStaleVersionDoNotAddEvents()
    {
        using var c = factory.Client(Tenant());
        var r = await Create(c);
        Assert.Equal(HttpStatusCode.Conflict, (await c.PostAsJsonAsync($"/api/records/{r.Id}/submit", new
        {
            expectedVersion = 99
        })).StatusCode);
        await Entry(await c.PostAsJsonAsync($"/api/records/{r.Id}/submit", new
        {
            expectedVersion = 1
        }));
        Assert.Equal(HttpStatusCode.Conflict, (await c.PostAsJsonAsync($"/api/records/{r.Id}/submit", new
        {
            expectedVersion = 2
        })).StatusCode);
        Assert.Equal(2, (await Json(await c.GetAsync($"/api/records/{r.Id}/history"))).GetArrayLength());
    }
    [Fact]
    public async Task ConcurrentSubmissionsHaveOneWinner()
    {
        using var c = factory.Client(Tenant());
        var r = await Create(c);
        var responses = await Task.WhenAll(c.PostAsJsonAsync($"/api/records/{r.Id}/submit", new
        {
            expectedVersion = 1
        }), c.PostAsJsonAsync($"/api/records/{r.Id}/submit", new
        {
            expectedVersion = 1
        }));
        Assert.Single(responses, x => x.StatusCode == HttpStatusCode.OK);
        Assert.Single(responses, x => x.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(2, (await Json(await c.GetAsync($"/api/records/{r.Id}/history"))).GetArrayLength());
    }
    [Fact]
    public async Task DuplicateExternalIdsAreTenantScoped()
    {
        var id = Guid.NewGuid().ToString("N");
        using var first = factory.Client(Tenant());
        using var second = factory.Client(Tenant());
        await Create(first, id);
        Assert.Equal(HttpStatusCode.Conflict, (await first.PostAsJsonAsync("/api/records", Input(id))).StatusCode);
        await Create(second, id);
    }
    [Theory]
    [InlineData(-1)]
    [InlineData(1.001)]
    [InlineData(10000000000)]
    public async Task InvalidAmountsAreRejected(double amount)
    {
        using var c = factory.Client(Tenant());
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/records", Input(amount: (decimal)amount))).StatusCode);
    }
    [Fact]
    public async Task PaginationHasStableCursorAndNoDuplicates()
    {
        using var c = factory.Client(Tenant());
        var a = await Create(c);
        var b = await Create(c);
        var first = await Json(await c.GetAsync("/api/records?limit=1"));
        Assert.Equal(a.Id, first.GetProperty("items")[0].GetProperty("id").GetInt32());
        var second = await Json(await c.GetAsync("/api/records?limit=1&afterId=" + first.GetProperty("nextAfterId").GetInt32()));
        Assert.Equal(b.Id, second.GetProperty("items")[0].GetProperty("id").GetInt32());
        Assert.Equal(JsonValueKind.Null, second.GetProperty("nextAfterId").ValueKind);
    }
    [Fact]
    public async Task AuditFailureRollsBackRecordChange()
    {
        var t = Tenant();
        using var c = factory.Client(t);
        var r = await Create(c);
        var name = "fail_" + Guid.NewGuid().ToString("N");
        await using var db = await factory.Services.GetRequiredService<NpgsqlDataSource>().OpenConnectionAsync();
        // A database fault scoped to this test tenant, not a test switch in application code.
        await using (var setup = new NpgsqlCommand($"CREATE FUNCTION reporting.{name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='{t}' THEN RAISE EXCEPTION 'Synthetic audit storage fault'; END IF; RETURN NEW; END; $$; CREATE TRIGGER {name} BEFORE INSERT ON reporting.audit_log FOR EACH ROW EXECUTE FUNCTION reporting.{name}()", db))
            await setup.ExecuteNonQueryAsync();
        try
        {
            Assert.Equal(HttpStatusCode.InternalServerError, (await c.PostAsJsonAsync($"/api/records/{r.Id}/submit", new
            {
                expectedVersion = 1
            })).StatusCode);
            var unchanged = await Entry(await c.GetAsync($"/api/records/{r.Id}"));
            Assert.Equal("draft", unchanged.WorkflowState);
            Assert.Equal(1, unchanged.Version);
            Assert.Equal(1, (await Json(await c.GetAsync($"/api/records/{r.Id}/history"))).GetArrayLength());
        }
        finally { await using var cleanup = new NpgsqlCommand($"DROP TRIGGER {name} ON reporting.audit_log; DROP FUNCTION reporting.{name}()", db); await cleanup.ExecuteNonQueryAsync(); }
    }
    [Fact]
    public async Task AuditEventsRejectUpdates()
    {
        using var c = factory.Client(Tenant());
        var r = await Create(c);
        await using var db = await factory.Services.GetRequiredService<NpgsqlDataSource>().OpenConnectionAsync();
        await using var cmd = new NpgsqlCommand("UPDATE reporting.audit_log SET action='correct' WHERE record_id=$1", db);
        cmd.Parameters.AddWithValue(r.Id);
        await Assert.ThrowsAsync<PostgresException>(() => cmd.ExecuteNonQueryAsync());
    }
    [Fact]
    public async Task MigrationsAreRepeatableAndRejectEditedHistory()
    {
        var db = factory.Services.GetRequiredService<NpgsqlDataSource>();
        var directory = Path.Combine(factory.Services.GetRequiredService<Microsoft.AspNetCore.Hosting.IWebHostEnvironment>().ContentRootPath, "sql");
        await MigrationRunner.ApplyAsync(factory.Services.GetRequiredService<IConfiguration>().GetConnectionString("Reporting")!, directory);
        await MigrationRunner.ApplyAsync(factory.Services.GetRequiredService<IConfiguration>().GetConnectionString("Reporting")!, directory);
        var temporary = Path.Combine(Path.GetTempPath(), "reporting-migration-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(temporary);
        try
        {
            await File.WriteAllTextAsync(Path.Combine(temporary, "001-schema.sql"), "SELECT 1;");
            await Assert.ThrowsAsync<InvalidOperationException>(() => MigrationRunner.ApplyAsync(factory.Services.GetRequiredService<IConfiguration>().GetConnectionString("Reporting")!, temporary));
        }
        finally { Directory.Delete(temporary, true); }
    }
    [Fact]
    public async Task ReadinessChecksDatabase()
    {
        using var c = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync("/health/ready")).StatusCode);
    }
}
