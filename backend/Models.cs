using System.Security.Claims;
namespace Reporting;

public record Actor(string Tenant, string Subject, bool Reviewer)
{
    public static Actor? TryCreate(ClaimsPrincipal user)
    {
        var tenant = user.FindFirst("tenant_id")?.Value;
        var subject = user.FindFirst("sub")?.Value;
        return string.IsNullOrWhiteSpace(tenant) || tenant.Length > 100 || string.IsNullOrWhiteSpace(subject) || subject.Length > 200 ? null : new(tenant, subject, user.IsInRole("reviewer"));
    }
}
public record CreateRecord(string ExternalId, string Department, DateOnly OccurredOn, decimal Amount, string Status);
public record CorrectRecord(int ExpectedVersion, string Department, DateOnly OccurredOn, decimal Amount, string Status, string Reason);
public record ReviewRequest(int ExpectedVersion, bool Approve, string Reason);
public record VersionRequest(int ExpectedVersion);
public record Entry(int Id, string ExternalId, string Department, DateOnly OccurredOn, decimal Amount, string Status, string OwnerId, string WorkflowState, int Version);
public record Audit(int Id, string ActorId, string Action, string? Reason, string? Before, string After, DateTime At);
public record Report(string Department, long Records, decimal Total, long Exceptions);
public record Outcome(Entry? Record, string? Error = null, int Status = 200);
public static class Rules
{
    public static bool ValidReason(string? text) => !string.IsNullOrWhiteSpace(text) && text.Trim().Length >= 3 && text.Length <= 500;
    public static bool Valid(string? external, string? department, DateOnly date, decimal amount, string? status) =>
        !string.IsNullOrWhiteSpace(external) && external.Length <= 100 && !string.IsNullOrWhiteSpace(department) && department.Trim().Length <= 80 && date.Year >= 1900 && date.Year <= 2100 && amount >= 0 && amount <= 9999999999.99m && decimal.Round(amount, 2) == amount && status is "valid" or "exception";
    public static IResult ToResult(Outcome result) => result.Error is null ? Results.Ok(result.Record) : Results.Json(new { error = result.Error }, statusCode: result.Status);
}
