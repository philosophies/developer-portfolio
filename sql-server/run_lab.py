"""Run the non-production SQL Server exercise in a disposable, unexposed container."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import secrets
import subprocess
import time
import uuid
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
IMAGE = 'mcr.microsoft.com/mssql/server@sha256:4525e3efac9f3e241cb003bb2ff2a82818b502f37e12049d788b1a9fa7e13b7f'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--accept-license', action='store_true', help='Confirm authorization for the Developer non-production license')
    parser.add_argument('--output', type=Path, default=ROOT / 'evidence')
    args = parser.parse_args()
    if not args.accept_license:
        parser.error('Explicit --accept-license authorization is required before starting SQL Server')
    import os
    env = dict(os.environ, MSSQL_SA_PASSWORD='Portfolio!' + secrets.token_hex(18))
    name = 'portfolio-sqlserver-' + uuid.uuid4().hex[:12]
    container = None

    def run(parts, data=None, timeout=120):
        result = subprocess.run(parts, input=data, capture_output=True, env=env, timeout=timeout)
        if result.returncode:
            raise RuntimeError((result.stderr + result.stdout).decode('utf-8', errors='replace').replace(env['MSSQL_SA_PASSWORD'], '[redacted]'))
        return result.stdout.decode('utf-8', errors='replace')

    def sql(statement, database='PortfolioLab'):
        # Password remains in environment; the connection stays inside this disposable container.
        env['SQLCMDPASSWORD'] = env['MSSQL_SA_PASSWORD']
        return run(['docker', 'exec', '-i', '-e', 'SQLCMDPASSWORD', container,
                    '/opt/mssql-tools18/bin/sqlcmd', '-S', 'localhost', '-U', 'sa', '-C',
                    '-b', '-r', '0', '-f', '65001', '-y', '0', '-w', '65535', '-d', database], statement.encode('utf-8'))

    try:
        container = run(['docker', 'run', '-d', '--name', name, '--label', 'portfolio.lab=sqlserver',
                         '--memory', '3g', '--cpus', '2', '-e', 'ACCEPT_EULA=Y', '-e', 'MSSQL_PID=Developer',
                         '-e', 'MSSQL_SA_PASSWORD', IMAGE]).strip()
        for attempt in range(60):
            try:
                sql('SELECT 1;\nGO\n', 'master')
                break
            except RuntimeError:
                if attempt == 59:
                    raise RuntimeError('SQL Server did not become ready within the startup budget')
                time.sleep(2)
        sql('CREATE DATABASE PortfolioLab;\nGO\n', 'master')
        sql((ROOT / 'schema.sql').read_text(encoding='utf-8-sig'))
        tests = sql((ROOT / 'tests.sql').read_text(encoding='utf-8-sig'))
        passed = re.findall(r'^PASS .+$', tests, re.MULTILINE)
        if len(passed) != 13:
            raise RuntimeError(f'Expected 13 SQL checks, received {len(passed)}: {tests}')
        plans = sql((ROOT / 'plans.sql').read_text(encoding='utf-8-sig'))
        documents = re.findall(r'<ShowPlanXML\b.*?</ShowPlanXML>', plans, re.DOTALL)
        if len(documents) != 2:
            raise RuntimeError('Expected two actual query plan XML documents')
        totals = re.findall(r'^\s*(\d+\.\d{2})\s*$', plans, re.MULTILINE)
        if len(totals) != 2 or totals[0] != totals[1]:
            raise RuntimeError('Before/after aggregation results differ or are missing')
        ns = {'p': 'http://schemas.microsoft.com/sqlserver/2004/07/showplan'}
        operations = []
        for document in documents:
            tree = ET.fromstring(document)
            if not tree.findall('.//p:RunTimeCountersPerThread', ns):
                raise RuntimeError('Plan has no actual runtime counters')
            operations.append(sorted({node.attrib['PhysicalOp'] for node in tree.findall('.//p:RelOp', ns)}))
        version = sql('SET NOCOUNT ON; SELECT @@VERSION;')
        image = json.loads(run(['docker', 'image', 'inspect', IMAGE]))[0]
        args.output.mkdir(parents=True, exist_ok=True)
        for label, document in zip(('before-index', 'after-index'), documents):
            (args.output / f'{label}.sqlplan').write_text(document, encoding='utf-8')
        (args.output / 'checks.txt').write_text(tests, encoding='utf-8')
        (args.output / 'io-and-results.txt').write_text(re.sub(r'<ShowPlanXML\b.*?</ShowPlanXML>', '[actual plan saved separately]', plans, flags=re.DOTALL), encoding='utf-8')
        report = {'recordedAt': datetime.now(timezone.utc).isoformat(), 'source': 'synthetic SQL Server exercise', 'engine': version.strip(),
                  'imageDigests': image.get('RepoDigests', []), 'checksPassed': len(passed),
                  'fixtureRows': 100000, 'aggregateTotal': totals[0],
                  'beforePhysicalOperations': operations[0], 'afterPhysicalOperations': operations[1],
                  'scope': 'One local run; no production performance or concurrency claim'}
        (args.output / 'summary.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        print('\n'.join(passed))
        print(json.dumps(report, indent=2))
    finally:
        if container:
            inspected = json.loads(run(['docker', 'inspect', container]))[0]
            if inspected['Config']['Labels'].get('portfolio.lab') != 'sqlserver' or inspected['Name'] != '/' + name:
                raise RuntimeError('Refusing cleanup of an unexpected container')
            run(['docker', 'rm', '-f', container])


if __name__ == '__main__':
    main()
