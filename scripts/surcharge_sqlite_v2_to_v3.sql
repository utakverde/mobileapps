BEGIN IMMEDIATE;

ALTER TABLE reading ADD COLUMN flag_surcharge INTEGER NOT NULL DEFAULT 0 CHECK(flag_surcharge IN (0,1));
ALTER TABLE reading ADD COLUMN surcharge_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE billhistory ADD COLUMN flag_surcharge INTEGER NOT NULL DEFAULT 0 CHECK(flag_surcharge IN (0,1));
ALTER TABLE billhistory ADD COLUMN surcharge_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE billhistory_disco ADD COLUMN flag_surcharge INTEGER NOT NULL DEFAULT 0 CHECK(flag_surcharge IN (0,1));
ALTER TABLE billhistory_disco ADD COLUMN surcharge_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN flag_surcharge INTEGER NOT NULL DEFAULT 0 CHECK(flag_surcharge IN (0,1));
ALTER TABLE invoices ADD COLUMN surcharge_amount REAL NOT NULL DEFAULT 0;

PRAGMA user_version = 3;
COMMIT;
