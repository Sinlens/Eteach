-- Reference data, not sample data.
--
-- This is a migration rather than `supabase/seed.sql` on purpose: seed.sql only
-- runs on a local `db reset`, never against a deployed project, and these rows
-- are pointed at by foreign keys from every table that matters. Without them
-- production cannot accept a single translation.
--
-- The ids here are the same ids the TypeScript contracts use. `db/schema.test.ts`
-- asserts that, so the two cannot drift apart silently.

insert into input_languages (id, label) values
  ('en', 'English');

insert into locales (id, language, country, spelling_standard, professional_style) values
  ('en-US', 'en', 'US', 'american', 'us_professional');

insert into careers (id, label, sort_order) values
  ('data_science',          'Data Science',          1),
  ('data_analytics',        'Data Analytics',        2),
  ('data_engineering',      'Data Engineering',      3),
  ('software_architecture', 'Software Architecture', 4);

insert into tones (id, label, sort_order) values
  ('professional', 'Professional', 1),
  ('friendly',     'Friendly',     2),
  ('concise',      'Concise',      3),
  ('technical',    'Technical',    4),
  ('linkedin',     'LinkedIn',     5),
  ('recruiter',    'Recruiter',    6),
  ('interview',    'Interview',    7);

insert into phrase_cards (id, phrase, meaning, example, career, category, difficulty, locale) values
  (
    'pc_data_engineering_01',
    'I''d be happy to discuss this further',
    'A warm, low-pressure way to keep a professional conversation open.',
    'I''d be happy to discuss the pipeline architecture further.',
    'data_engineering',
    'recruiter_messages',
    'intermediate',
    'en-US'
  ),
  (
    'pc_data_science_01',
    'I''d be happy to walk you through this',
    'Offers to explain your work without assuming the other person needs it.',
    'I''d be happy to walk you through how we evaluated the model.',
    'data_science',
    'technical_explanations',
    'intermediate',
    'en-US'
  ),
  (
    'pc_data_analytics_01',
    'happy to walk you through the numbers',
    'Invites a stakeholder into the detail without overwhelming them up front.',
    'The dashboard is live — happy to walk you through the numbers whenever suits you.',
    'data_analytics',
    'status_updates',
    'intermediate',
    'en-US'
  ),
  (
    'pc_software_architecture_01',
    'let''s align on the approach',
    'Frames a technical decision as shared rather than handed down.',
    'Before we commit to the migration, let''s align on the approach.',
    'software_architecture',
    'meetings',
    'advanced',
    'en-US'
  );
