export const partnerBackupMigrations={
 '008-partners-finance.json':['partners_settings','partners_product_policies','partners_rules','partners_commissions','partners_ledger','partners_financial_events'],
 '009-partners-operations.json':['partners_profiles','partners_links','partners_clicks','partners_stores','partners_notifications','partners_audit','partners_fraud_cases'],
 '010-partners-payouts.json':['partners_bank_accounts','partners_payouts','partners_payout_entries','partners_payout_batches','partners_payout_evidence','partners_campaigns','partners_coupons','partners_tiers'],
};
export const creativeBackupMigrations={
 '011-creative-hub.json':['creative_profiles','creative_briefs','creative_wishes','creative_wish_interests','creative_concepts','creative_stories','creative_templates','creative_contributions'],
 '012-design-rooms.json':['design_rooms','design_room_members','design_room_invites','design_room_ideas','design_room_votes','design_room_messages'],
 '013-creative-personalisations.json':['creative_personalisations']
};
export const additiveBackupMigrations={'017-journal.json':['journal_categories','journal_authors','journal_articles','journal_translations','journal_redirects','journal_media'],...partnerBackupMigrations,...creativeBackupMigrations,'014-shopping-insights.json':['shopping_metrics','shopping_metric_receipts'],'015-artist-profiles.json':['artist_profile_drafts','artist_follows','artist_notifications','artist_releases']};
export const backupTables=['users','account_emails','auth_identities','artists','products','orders','settings','messages','rate_limits','uploads','customer_state','customer_designs','customer_design_drafts','password_resets','mail_queue','mail_delivery','product_reviews','audit_log',...Object.values(additiveBackupMigrations).flat()];
