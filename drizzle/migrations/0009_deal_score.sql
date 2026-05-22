ALTER TABLE flip_opportunities ADD COLUMN deal_score INT;
ALTER TABLE flip_opportunities ADD COLUMN score_breakdown JSONB;
ALTER TABLE flip_opportunities ADD COLUMN explainer TEXT;
ALTER TABLE flip_opportunities ADD COLUMN est_recond_eur INT DEFAULT 800;
ALTER TABLE flip_opportunities ADD COLUMN est_profit_eur INT;
CREATE INDEX flip_opportunities_deal_score_idx ON flip_opportunities (deal_score DESC);
