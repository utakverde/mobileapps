"""Create an empty SQLite database from the checked-in schema."""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: create_sanitized_database.py SCHEMA OUTPUT", file=sys.stderr)
        return 2

    schema_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve()
    if not schema_path.is_file():
        raise FileNotFoundError(schema_path)
    if output_path.exists():
        raise FileExistsError(output_path)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    schema = schema_path.read_text(encoding="utf-8")

    with sqlite3.connect(output_path) as database:
        database.executescript(schema)
        integrity = database.execute("PRAGMA quick_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"SQLite quick_check failed: {integrity}")

        tables = [
            row[0]
            for row in database.execute(
                "SELECT name FROM sqlite_master "
                "WHERE type = 'table' AND name NOT LIKE 'sqlite_%' "
                "ORDER BY name"
            )
        ]
        populated = {
            table: database.execute(
                f'SELECT COUNT(*) FROM "{table.replace(chr(34), chr(34) * 2)}"'
            ).fetchone()[0]
            for table in tables
        }
        populated = {table: count for table, count in populated.items() if count}
        if populated:
            raise RuntimeError(f"Sanitized database contains rows: {populated}")

    print(f"Created empty SQLite database with {len(tables)} tables: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
