CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX properties_name_trgm ON properties USING GIN(name gin_trgm_ops);
