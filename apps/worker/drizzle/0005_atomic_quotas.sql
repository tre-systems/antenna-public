-- Enforce capacity at the serialized write boundary, not only in preflight reads.
-- Existing over-limit collections remain intact; updates and deletions are unaffected.
CREATE TRIGGER collections_insert_quota
BEFORE INSERT ON collections
WHEN (SELECT count(*) FROM collections WHERE owner_id = NEW.owner_id) >= 10
BEGIN
  SELECT RAISE(ABORT, 'collection_quota_exceeded');
END;

CREATE TRIGGER signals_insert_quota
BEFORE INSERT ON signals
WHEN (SELECT count(*) FROM signals WHERE collection_id = NEW.collection_id) >= 50
BEGIN
  SELECT RAISE(ABORT, 'signal_quota_exceeded');
END;
