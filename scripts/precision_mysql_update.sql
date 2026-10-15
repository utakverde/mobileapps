-- Billing precision update for the desktop MySQL database.
-- Run against the selected FUBCS database after making a database backup.
--
-- Rules:
--   * Rate columns and per-rate charge amount columns: DECIMAL(20,8)
--   * Final payable/currency boundary columns: DECIMAL(20,2)
--
-- This script uses the current database selected by USE <database_name>.

DROP PROCEDURE IF EXISTS apply_billing_precision_8;

DELIMITER $$

CREATE PROCEDURE apply_billing_precision_8()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE v_table VARCHAR(128);
  DECLARE v_column VARCHAR(128);
  DECLARE v_scale INT;
  DECLARE v_sql TEXT;

  DECLARE cur CURSOR FOR
    SELECT TABLE_NAME, COLUMN_NAME,
      CASE
        WHEN COLUMN_NAME IN (
          'TotalBill', 'balance_previous', 'amount_previous', 'amount_collected',
          'amt_tendered', 'amt_change', 'ORCollection', 'paid_amount_total'
        ) THEN 2
        ELSE 8
      END AS target_scale
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND DATA_TYPE IN ('decimal', 'double', 'float', 'real')
      AND TABLE_NAME IN (
        'tblerc', 'master', 'billhistory', 'billhistory_arrears',
        'billhistory_disco', 'billhistory_disco_arrears',
        'reading', 'reading_pay', 'setup'
      )
      AND (
        COLUMN_NAME REGEXP '^(Rate_|Vat_|EVAT_|Res_|Com_|Ind_|Pub_|Str_|B_|CHV_|PHV_)'
        OR COLUMN_NAME IN (
          'GenSysCharge', 'HostCommCharge', 'ForexCharge', 'FPCA',
          'TCDemandCharge', 'TCTransSystemCharge', 'SystemLossCharge',
          'DCDemandCharge', 'DCDistributionCharge', 'SCRetCustCharge',
          'SCSupplySysCharge', 'MCRetailCustCharge', 'MCSystemCharge',
          'UCNPCStrandedDebts', 'UCNPCStrandedContCost', 'UCDUStrandedContCost',
          'UCME', 'UCEqTaxesAndRoyalties', 'UCEC', 'UCCrossSubRemoval',
          'ICCrossSubsidyCharge', 'PowerActRateRed', 'LifelineDiscSubs',
          'LoanCondo', 'LoanCondoRetail', 'TransformerRental',
          'OCAmount1', 'OCAmount2', 'OCAmount3', 'OCTotal1', 'OCTotal2', 'OCTotal3',
          'EVAT', 'EVAT_GenCharge', 'EVAT_SystemLoss', 'EVAT_Trans_Charge',
          'EVAT_Dist_Charge', 'EVAT_OtherVat', 'MCC', 'MCC_Substation',
          'FitAll', 'GenRefund', 'TransRefund', 'SysLossRefund',
          'LifelineCollect', 'SeniorRefund', 'RPPD', 'ICCS', 'TrueUp',
          'UCME_Redci', 'RealPropertyTax', 'GEA_ALL', 'REX',
          'senior_citizen_disc', 'senior_citizen_subsidy',
          'TotalBill', 'balance_previous', 'amount_previous', 'amount_collected',
          'amt_tendered', 'amt_change', 'ORCollection', 'paid_amount_total'
        )
      );

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO v_table, v_column, v_scale;
    IF done = 1 THEN
      LEAVE read_loop;
    END IF;

    SET v_sql = CONCAT(
      'ALTER TABLE `', REPLACE(v_table, '`', '``'),
      '` MODIFY COLUMN `', REPLACE(v_column, '`', '``'),
      '` DECIMAL(20,', v_scale, ') NULL'
    );
    PREPARE stmt FROM v_sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END LOOP;
  CLOSE cur;
END$$

DELIMITER ;

CALL apply_billing_precision_8();
DROP PROCEDURE IF EXISTS apply_billing_precision_8;
