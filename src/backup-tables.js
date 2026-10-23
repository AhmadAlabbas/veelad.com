export const partnerBackupMigrations={
 '008-partners-finance.json':['partners_settings','partners_product_policies','partners_rules','partners_commissions','partners_ledger','partners_financial_events'],
 '009-partners-operations.json':['partners_profiles','partners_links','partners_clicks','partners_stores','partners_notifications','partners_audit','partners_fraud_cases'],
 '010-partners-payouts.json':['partners_bank_accounts','partners_payouts','partners_payout_entries','partners_payout_batches','partners_payout_evidence','partners_campaigns','partners_coupons','partners_tiers'],
};
export const backupTables=['users','account_emails','auth_identities','artists','products','orders','settings','messages','rate_limits','uploads','customer_state','customer_designs','customer_design_drafts','password_resets','mail_queue','mail_delivery','product_reviews','audit_log',...Object.values(partnerBackupMigrations).flat()];
