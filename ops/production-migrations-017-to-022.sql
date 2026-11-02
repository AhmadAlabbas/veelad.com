-- Veelad production migration: source verified at Git commit 6a146dcd583fa50ab8281f23f64dcdefe388511b.
-- Required backups: SQL dump and private artwork, including off-server copies.
-- Only for the production database u260732541_veeladprod; MySQL DDL auto-commits and cannot be rolled back as one unit.
-- The official application migrator should be used if a suitable authenticated Node runtime becomes available.
SET NAMES utf8mb4;
-- 017-journal.json / checksum a84908a2c97748fc1ec4b2c12ddc0ffcc88013ef5a23b4b5627e9d6f4422cdeb
CREATE TABLE IF NOT EXISTS journal_categories (id VARCHAR(64) PRIMARY KEY,name VARCHAR(160) NOT NULL,name_ar VARCHAR(160) NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS journal_authors (id VARCHAR(64) PRIMARY KEY,name VARCHAR(160) NOT NULL,name_ar VARCHAR(160) NOT NULL,bio TEXT NOT NULL,bio_ar TEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS journal_articles (id VARCHAR(64) PRIMARY KEY,author_id VARCHAR(64),category_id VARCHAR(64),featured INTEGER NOT NULL DEFAULT 0,archived INTEGER NOT NULL DEFAULT 0,data MEDIUMTEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,created_at VARCHAR(40) NOT NULL,updated_at VARCHAR(40) NOT NULL,INDEX journal_editorial(updated_at,id),INDEX journal_category(category_id),INDEX journal_author(author_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS journal_translations (article_id VARCHAR(64) NOT NULL,locale VARCHAR(2) NOT NULL,slug VARCHAR(160) NOT NULL,title VARCHAR(240) NOT NULL,summary TEXT NOT NULL,content MEDIUMTEXT NOT NULL,status VARCHAR(16) NOT NULL,publish_at VARCHAR(40),published_at VARCHAR(40),data TEXT NOT NULL,PRIMARY KEY(article_id,locale),UNIQUE KEY journal_slug(locale,slug),INDEX journal_public(locale,status,publish_at,published_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS journal_redirects (locale VARCHAR(2) NOT NULL,slug VARCHAR(160) NOT NULL,article_id VARCHAR(64) NOT NULL,PRIMARY KEY(locale,slug)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS journal_media (upload_id VARCHAR(64) PRIMARY KEY,article_id VARCHAR(64) NOT NULL,locale VARCHAR(2) NOT NULL,INDEX journal_media_article(article_id,locale)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO journal_categories VALUES ('fashion-style','Fashion & Style','الأزياء والأناقة',0);
INSERT IGNORE INTO journal_categories VALUES ('streetwear','Streetwear','أزياء الشارع',1);
INSERT IGNORE INTO journal_categories VALUES ('artist-stories','Artist Stories','حكايات الفنانين',2);
INSERT IGNORE INTO journal_categories VALUES ('behind-designs','Behind the Designs','خلف التصاميم',3);
INSERT IGNORE INTO journal_categories VALUES ('new-collections','New Collections','مجموعات جديدة',4);
INSERT IGNORE INTO journal_categories VALUES ('fashion-trends','Fashion Trends','اتجاهات الموضة',5);
INSERT IGNORE INTO journal_categories VALUES ('styling-guides','Styling Guides','دليل التنسيق',6);
INSERT IGNORE INTO journal_categories VALUES ('sustainability-materials','Sustainability & Materials','الاستدامة والخامات',7);
INSERT IGNORE INTO journal_categories VALUES ('veelad-news','Veelad News','أخبار فيلاد',8);
INSERT IGNORE INTO journal_categories VALUES ('culture-creativity','Culture & Creativity','الثقافة والإبداع',9);
INSERT INTO schema_migrations (id,checksum,applied_at) VALUES ('017-journal.json','a84908a2c97748fc1ec4b2c12ddc0ffcc88013ef5a23b4b5627e9d6f4422cdeb', DATE_FORMAT(UTC_TIMESTAMP(3),'%Y-%m-%dT%H:%i:%s.%fZ'));
-- 018-international.json / checksum 4e0cc4543bf2b21a61e62d1facdb559e2c6c6cb2238f1556a3a8db2510471f06
CREATE TABLE IF NOT EXISTS currency_rate_batches (id VARCHAR(64) PRIMARY KEY,source VARCHAR(80) NOT NULL,quoted_at VARCHAR(40) NOT NULL,fetched_at VARCHAR(40) NOT NULL,next_refresh_at VARCHAR(40) NOT NULL,rates JSON NOT NULL,INDEX fx_quote_time (quoted_at,fetched_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO schema_migrations (id,checksum,applied_at) VALUES ('018-international.json','4e0cc4543bf2b21a61e62d1facdb559e2c6c6cb2238f1556a3a8db2510471f06', DATE_FORMAT(UTC_TIMESTAMP(3),'%Y-%m-%dT%H:%i:%s.%fZ'));
-- 019-journal-locales.json / checksum dfc091e68b5330cbb3ef149afbbd4cbd1b56efd4f7fe7838749f6c045819040d
ALTER TABLE journal_translations MODIFY locale VARCHAR(5) NOT NULL;
ALTER TABLE journal_redirects MODIFY locale VARCHAR(5) NOT NULL;
ALTER TABLE journal_media MODIFY locale VARCHAR(5) NOT NULL;
INSERT INTO schema_migrations (id,checksum,applied_at) VALUES ('019-journal-locales.json','dfc091e68b5330cbb3ef149afbbd4cbd1b56efd4f7fe7838749f6c045819040d', DATE_FORMAT(UTC_TIMESTAMP(3),'%Y-%m-%dT%H:%i:%s.%fZ'));
-- 020-currency-backup-format.json / checksum f27ad278def4a1447553d309409f80712f9b29a96396c8a20567192aca6a908f
ALTER TABLE currency_rate_batches MODIFY rates TEXT NOT NULL;
INSERT INTO schema_migrations (id,checksum,applied_at) VALUES ('020-currency-backup-format.json','f27ad278def4a1447553d309409f80712f9b29a96396c8a20567192aca6a908f', DATE_FORMAT(UTC_TIMESTAMP(3),'%Y-%m-%dT%H:%i:%s.%fZ'));
-- 021-artist-follow-locales.json / checksum b69d9f417ec6103ed9cfde64d2b2dbf387f1cebabbb7834c0bc8da34c3f878a6
ALTER TABLE artist_follows MODIFY language VARCHAR(5) NOT NULL;
INSERT INTO schema_migrations (id,checksum,applied_at) VALUES ('021-artist-follow-locales.json','b69d9f417ec6103ed9cfde64d2b2dbf387f1cebabbb7834c0bc8da34c3f878a6', DATE_FORMAT(UTC_TIMESTAMP(3),'%Y-%m-%dT%H:%i:%s.%fZ'));
-- 022-customer-draft-versions.json / checksum b70925bd7cb2238798055f686564aaa8dfecdfff450f859ff4c649e7cbdffc2a
CREATE TABLE IF NOT EXISTS customer_design_draft_versions (draft_id VARCHAR(64) NOT NULL,user_id VARCHAR(64) NOT NULL,revision INT NOT NULL,product_id VARCHAR(64) NOT NULL,data MEDIUMTEXT NOT NULL,created_at VARCHAR(40) NOT NULL,PRIMARY KEY(draft_id,revision),INDEX (user_id,draft_id,revision)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO schema_migrations (id,checksum,applied_at) VALUES ('022-customer-draft-versions.json','b70925bd7cb2238798055f686564aaa8dfecdfff450f859ff4c649e7cbdffc2a', DATE_FORMAT(UTC_TIMESTAMP(3),'%Y-%m-%dT%H:%i:%s.%fZ'));
SELECT id FROM schema_migrations WHERE id >= '017' ORDER BY id;
