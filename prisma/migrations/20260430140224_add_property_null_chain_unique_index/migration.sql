-- Create a partial unique index to prevent duplicate independent properties with the same name that have no location data.
CREATE UNIQUE INDEX properties_name_null_chain_no_place_idx
ON properties (name)
WHERE hotel_chain_id IS NULL AND place_id IS NULL;
