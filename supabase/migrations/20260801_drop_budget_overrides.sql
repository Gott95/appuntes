-- Budget is now calculated dynamically (rolling) from transactions.
-- The budget_overrides table is no longer used.
DROP TABLE IF EXISTS budget_overrides;
