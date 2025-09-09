/*
  # Fix question_type column length constraint

  1. Changes
    - Alter question_type column from VARCHAR(10) to VARCHAR(20) to accommodate longer values
    - Update check constraint to allow proper question types
    
  2. Security
    - No changes to RLS policies needed
*/

-- Drop the existing check constraint
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_question_type_check;

-- Alter the column to increase length
ALTER TABLE questions ALTER COLUMN question_type TYPE VARCHAR(20);

-- Recreate the check constraint with the new column type
ALTER TABLE questions ADD CONSTRAINT questions_question_type_check 
CHECK (((question_type)::text = ANY ((ARRAY['single_choice'::character varying, 'multiple_choice'::character varying])::text[])));