BEGIN IMMEDIATE;

ALTER TABLE reading ADD COLUMN disconnection_date TEXT;
ALTER TABLE billhistory ADD COLUMN disconnection_date TEXT;
ALTER TABLE billhistory_disco ADD COLUMN disconnection_date TEXT;

UPDATE reading
SET disconnection_date = Sched_DisconnectionDate
WHERE NULLIF(TRIM(disconnection_date), '') IS NULL
  AND NULLIF(TRIM(Sched_DisconnectionDate), '') IS NOT NULL;

UPDATE billhistory
SET disconnection_date = DiscoDate
WHERE NULLIF(TRIM(disconnection_date), '') IS NULL
  AND NULLIF(TRIM(DiscoDate), '') IS NOT NULL;

UPDATE billhistory_disco
SET disconnection_date = DiscoDate
WHERE NULLIF(TRIM(disconnection_date), '') IS NULL
  AND NULLIF(TRIM(DiscoDate), '') IS NOT NULL;

PRAGMA user_version = 4;
COMMIT;
