using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;
using System.Text.Json;
using Xunit;
public class ReportsTests : IClassFixture<WebApplicationFactory<Program>> {
 readonly HttpClient client;
 public ReportsTests(WebApplicationFactory<Program> factory) { client = factory.CreateClient(); }
 [Theory]
 [InlineData("?from=2026-02-01&to=2026-01-01")]
 [InlineData("?limit=0")]
 [InlineData("?limit=101")]
 [InlineData("?from=invalid")]
 public async Task RejectsInvalidQuery(string query) { Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/reports"+query)).StatusCode); }
 [Fact] public async Task AggregatesSeededRecords() {
  using var response = await client.GetAsync("/api/reports"); response.EnsureSuccessStatusCode();
  using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
  var rows = json.RootElement.GetProperty("rows"); Assert.Equal(2, rows.GetArrayLength());
  var operations = rows.EnumerateArray().Single(x=>x.GetProperty("department").GetString()=="Operations");
  Assert.Equal(165.50m, operations.GetProperty("total").GetDecimal()); Assert.Equal(1,operations.GetProperty("exceptions").GetInt64());
 }
 [Fact] public async Task DateFilterExcludesRecords() {
  using var json = JsonDocument.Parse(await client.GetStringAsync("/api/reports?from=2026-03-01"));
  Assert.Equal(0,json.RootElement.GetProperty("rows").GetArrayLength());
 }
}
