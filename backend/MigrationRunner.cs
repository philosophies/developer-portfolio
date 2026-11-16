using System.Security.Cryptography;
using Npgsql;
namespace Reporting;

public static class MigrationRunner
{
    public static async Task ApplyAsync(string connectionString, string directory)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using (var schema = new NpgsqlCommand("CREATE SCHEMA IF NOT EXISTS reporting; CREATE TABLE IF NOT EXISTS reporting.schema_migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())", connection))
            await schema.ExecuteNonQueryAsync();
        foreach (var path in Directory.GetFiles(directory, "*.sql").Order(StringComparer.Ordinal))
        {
            var sql = (await File.ReadAllTextAsync(path)).Replace("\r\n", "\n");
            var hash = Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(sql)));
            var name = Path.GetFileName(path);
            await using var tx = await connection.BeginTransactionAsync();
            await using (var gate = new NpgsqlCommand("SELECT pg_advisory_xact_lock(87511013)", connection, tx))
                await gate.ExecuteNonQueryAsync();
            await using var lookup = new NpgsqlCommand("SELECT sha256 FROM reporting.schema_migrations WHERE name=$1", connection, tx);
            lookup.Parameters.AddWithValue(name);
            var existing = await lookup.ExecuteScalarAsync();
            if (existing is string checksum)
            {
                if (checksum != hash)
                    throw new InvalidOperationException($"Applied migration {name} changed; add a new migration instead");
                await tx.CommitAsync();
                continue;
            }
            await using (var command = new NpgsqlCommand(sql, connection, tx))
                await command.ExecuteNonQueryAsync();
            await using var record = new NpgsqlCommand("INSERT INTO reporting.schema_migrations(name,sha256) VALUES($1,$2)", connection, tx);
            record.Parameters.AddWithValue(name);
            record.Parameters.AddWithValue(hash);
            await record.ExecuteNonQueryAsync();
            await tx.CommitAsync();
            Console.WriteLine($"Applied {name}");
        }
    }
}
