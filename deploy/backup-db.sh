#!/usr/bin/env bash
# Nightly database + uploads backup, keeps the last 14 days.
#   chmod +x deploy/backup-db.sh
#   crontab -e   and add:   30 2 * * * /home/ubuntu/sainandchits/deploy/backup-db.sh >> /home/ubuntu/backups/backup.log 2>&1
# Optional off-server copy: set S3_BUCKET (needs the AWS CLI and an IAM role with write access).
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Read DATABASE_URL from .env without printing it.
DATABASE_URL="$(grep -E '^(EXTERNAL_)?DATABASE_URL=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
if [ -z "$DATABASE_URL" ]; then echo "$(date) DATABASE_URL not found in .env" >&2; exit 1; fi

DB_FILE="$BACKUP_DIR/sainand-db-$STAMP.dump"
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$DB_FILE"
tar -czf "$BACKUP_DIR/sainand-uploads-$STAMP.tar.gz" -C "$APP_DIR" uploads 2>/dev/null || true
chmod 600 "$BACKUP_DIR"/sainand-*-"$STAMP".*

# Quick check that the dump can be read back.
pg_restore --list "$DB_FILE" > /dev/null

if [ -n "${S3_BUCKET:-}" ]; then
  aws s3 cp "$DB_FILE" "s3://$S3_BUCKET/db/" --only-show-errors
  aws s3 cp "$BACKUP_DIR/sainand-uploads-$STAMP.tar.gz" "s3://$S3_BUCKET/uploads/" --only-show-errors || true
fi

find "$BACKUP_DIR" -name 'sainand-*' -mtime +"$KEEP_DAYS" -delete
echo "$(date) backup ok: $(du -h "$DB_FILE" | cut -f1) database"
