using System.Text.Json;
using Npgsql;
namespace Reporting;

public sealed class RecordStore(NpgsqlDataSource db, ILogger<RecordStore> logger)
{
    const string Columns = "id,external_id,department,occurred_on,amount,status,owner_id,workflow_state,version";
    static Entry Read(NpgsqlDataReader r) => new(r.GetInt32(0), r.GetString(1), r.GetString(2), r.GetFieldValue<DateOnly>(3), r.GetDecimal(4), r.GetString(5), r.GetString(6), r.GetString(7), r.GetInt32(8));
    public async Task<Entry?> Get(Actor actor, int id, CancellationToken ct)
    {
        await using var cmd = db.CreateCommand($"SELECT {Columns} FROM reporting.records WHERE id=$1 AND tenant_id=$2 AND (owner_id=$3 OR $4)");
        cmd.Parameters.AddWithValue(id);
        cmd.Parameters.AddWithValue(actor.Tenant);
        cmd.Parameters.AddWithValue(actor.Subject);
        cmd.Parameters.AddWithValue(actor.Reviewer);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        return await r.ReadAsync(ct) ? Read(r) : null;
    }
    public async Task<List<Entry>> List(Actor actor, int after, int limit, CancellationToken ct)
    {
        await using var cmd = db.CreateCommand($"SELECT {Columns} FROM reporting.records WHERE tenant_id=$1 AND (owner_id=$2 OR $3) AND id>$4 ORDER BY id LIMIT $5");
        cmd.Parameters.AddWithValue(actor.Tenant);
        cmd.Parameters.AddWithValue(actor.Subject);
        cmd.Parameters.AddWithValue(actor.Reviewer);
        cmd.Parameters.AddWithValue(after);
        cmd.Parameters.AddWithValue(limit);
        var result = new List<Entry>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            result.Add(Read(r));
        return result;
    }
    public async Task<List<Report>> Report(Actor actor, DateOnly from, DateOnly to, int limit, CancellationToken ct)
    {
        await using var cmd = db.CreateCommand("SELECT department,count(*),sum(amount),count(*) FILTER(WHERE status='exception') FROM reporting.records WHERE tenant_id=$1 AND (owner_id=$2 OR $3) AND workflow_state='approved' AND occurred_on BETWEEN $4 AND $5 GROUP BY department ORDER BY department LIMIT $6");
        cmd.Parameters.AddWithValue(actor.Tenant);
        cmd.Parameters.AddWithValue(actor.Subject);
        cmd.Parameters.AddWithValue(actor.Reviewer);
        cmd.Parameters.AddWithValue(from);
        cmd.Parameters.AddWithValue(to);
        cmd.Parameters.AddWithValue(limit);
        var result = new List<Report>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            result.Add(new(r.GetString(0), r.GetInt64(1), r.GetDecimal(2), r.GetInt64(3)));
        return result;
    }
    public async Task<List<Audit>> History(Actor actor, int id, CancellationToken ct)
    {
        await using var cmd = db.CreateCommand("SELECT id,actor_id,action,reason,before_state::text,after_state::text,occurred_at FROM reporting.audit_log WHERE tenant_id=$1 AND record_id=$2 ORDER BY id");
        cmd.Parameters.AddWithValue(actor.Tenant);
        cmd.Parameters.AddWithValue(id);
        var result = new List<Audit>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            result.Add(new(r.GetInt32(0), r.GetString(1), r.GetString(2), r.IsDBNull(3) ? null : r.GetString(3), r.IsDBNull(4) ? null : r.GetString(4), r.GetString(5), r.GetDateTime(6)));
        return result;
    }
    public async Task<Outcome> Create(Actor actor, CreateRecord input, CancellationToken ct)
    {
        await using var connection = await db.OpenConnectionAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        try
        {
            await using var cmd = new NpgsqlCommand($"INSERT INTO reporting.records(tenant_id,external_id,owner_id,department,occurred_on,amount,status,workflow_state,version) VALUES($1,$2,$3,$4,$5,$6,$7,'draft',1) RETURNING {Columns}", connection, tx);
            cmd.Parameters.AddWithValue(actor.Tenant);
            cmd.Parameters.AddWithValue(input.ExternalId.Trim());
            cmd.Parameters.AddWithValue(actor.Subject);
            cmd.Parameters.AddWithValue(input.Department.Trim());
            cmd.Parameters.AddWithValue(input.OccurredOn);
            cmd.Parameters.AddWithValue(input.Amount);
            cmd.Parameters.AddWithValue(input.Status);
            Entry entry;
            await using (var reader = await cmd.ExecuteReaderAsync(ct))
            {
                await reader.ReadAsync(ct);
                entry = Read(reader);
            }
            await Append(connection, tx, actor, "create", null, null, entry, ct);
            await tx.CommitAsync(ct);
            logger.LogInformation("Record {RecordId} created at version {Version}", entry.Id, entry.Version);
            return new(entry);
        }
        catch (PostgresException e) when (e.SqlState == PostgresErrorCodes.UniqueViolation && e.ConstraintName == "records_tenant_id_external_id_key") { return new(null, "External ID already exists", 409); }
    }
    public async Task<Outcome> Change(Actor actor, int id, int expected, string action, string? reason, CorrectRecord? correction, CancellationToken ct)
    {
        if (expected < 1)
            return new(null, "Expected version must be positive", 400);
        await using var connection = await db.OpenConnectionAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        await using var select = new NpgsqlCommand($"SELECT {Columns} FROM reporting.records WHERE id=$1 AND tenant_id=$2 AND (owner_id=$3 OR $4) FOR UPDATE", connection, tx);
        select.Parameters.AddWithValue(id);
        select.Parameters.AddWithValue(actor.Tenant);
        select.Parameters.AddWithValue(actor.Subject);
        select.Parameters.AddWithValue(actor.Reviewer);
        Entry before;
        await using (var reader = await select.ExecuteReaderAsync(ct))
        {
            if (!await reader.ReadAsync(ct))
                return new(null, "Record not found", 404);
            before = Read(reader);
        }
        if (action is "submit" or "correct" && before.OwnerId != actor.Subject)
            return new(null, "Only the owner can change this record", 403);
        if (action is "approve" or "reject" && (!actor.Reviewer || before.OwnerId == actor.Subject))
            return new(null, "Independent reviewer required", 403);
        if (before.Version != expected)
            return new(null, "Record changed; refresh and retry", 409);
        var state = action switch
        {
            "submit" when before.WorkflowState == "draft" => "submitted",
            "approve" when before.WorkflowState == "submitted" => "approved",
            "reject" when before.WorkflowState == "submitted" => "rejected",
            "correct" when before.WorkflowState != "submitted" => "draft",
            _ => null
        };
        if (state is null)
            return new(null, "Invalid workflow transition", 409);
        var after = before with
        {
            Department = correction?.Department.Trim() ?? before.Department,
            OccurredOn = correction?.OccurredOn ?? before.OccurredOn,
            Amount = correction?.Amount ?? before.Amount,
            Status = correction?.Status ?? before.Status,
            WorkflowState = state,
            Version = before.Version + 1
        };
        await using var update = new NpgsqlCommand("UPDATE reporting.records SET department=$1,occurred_on=$2,amount=$3,status=$4,workflow_state=$5,version=$6 WHERE id=$7 AND tenant_id=$8", connection, tx);
        update.Parameters.AddWithValue(after.Department);
        update.Parameters.AddWithValue(after.OccurredOn);
        update.Parameters.AddWithValue(after.Amount);
        update.Parameters.AddWithValue(after.Status);
        update.Parameters.AddWithValue(after.WorkflowState);
        update.Parameters.AddWithValue(after.Version);
        update.Parameters.AddWithValue(id);
        update.Parameters.AddWithValue(actor.Tenant);
        await update.ExecuteNonQueryAsync(ct);
        await Append(connection, tx, actor, action, reason, before, after, ct);
        await tx.CommitAsync(ct);
        logger.LogInformation("Record {RecordId} transitioned to {State} at version {Version}", id, state, after.Version);
        return new(after);
    }
    static async Task Append(NpgsqlConnection connection, NpgsqlTransaction tx, Actor actor, string action, string? reason, Entry? before, Entry after, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("INSERT INTO reporting.audit_log(tenant_id,record_id,actor_id,action,reason,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)", connection, tx);
        cmd.Parameters.AddWithValue(actor.Tenant);
        cmd.Parameters.AddWithValue(after.Id);
        cmd.Parameters.AddWithValue(actor.Subject);
        cmd.Parameters.AddWithValue(action);
        cmd.Parameters.AddWithValue(NpgsqlTypes.NpgsqlDbType.Text, (object?)reason ?? DBNull.Value);
        cmd.Parameters.AddWithValue(NpgsqlTypes.NpgsqlDbType.Text, before is null ? DBNull.Value : JsonSerializer.Serialize(before));
        cmd.Parameters.AddWithValue(JsonSerializer.Serialize(after));
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
