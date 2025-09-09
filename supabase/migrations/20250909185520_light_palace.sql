/*
  # Fix question_type column length constraint

  1. Changes
    - Alter `question_type` column in `questions` table to use VARCHAR(20) instead of VARCHAR(10)
    - This allows storing 'single_choice' (12 chars) and 'multiple_choice' (15 chars) values
    
  2. Security
    - No RLS changes needed as this is just a column type modification
*/

-- Alter the question_type column to allow longer values
ALTER TABLE questions 
ALTER COLUMN question_type TYPE VARCHAR(20);

-- Update the check constraint to ensure it still validates the allowed values
ALTER TABLE questions 
DROP CONSTRAINT IF EXISTS questions_question_type_check;

ALTER TABLE questions 
ADD CONSTRAINT questions_question_type_check 
CHECK (question_type IN ('single_choice', 'multiple_choice'));