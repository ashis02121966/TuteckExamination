/*
  # Create user login function to bypass RLS

  1. New Functions
    - `get_user_with_role` - Fetches user data with role information bypassing RLS
  
  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS policies
    - Only accessible to authenticated users
    - Returns flattened user and role data to avoid recursion
*/

-- Create function to get user with role data, bypassing RLS
CREATE OR REPLACE FUNCTION get_user_with_role(user_id uuid)
RETURNS TABLE (
  id uuid,
  email varchar,
  name varchar,
  role_id uuid,
  is_active boolean,
  jurisdiction varchar,
  zone varchar,
  region varchar,
  district varchar,
  employee_id varchar,
  phone_number varchar,
  parent_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  role_name varchar,
  role_description text,
  role_level integer,
  role_is_active boolean,
  role_menu_access text[],
  role_created_at timestamptz,
  role_updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.name,
    u.role_id,
    u.is_active,
    u.jurisdiction,
    u.zone,
    u.region,
    u.district,
    u.employee_id,
    u.phone_number,
    u.parent_id,
    u.created_at,
    u.updated_at,
    r.name as role_name,
    r.description as role_description,
    r.level as role_level,
    r.is_active as role_is_active,
    r.menu_access as role_menu_access,
    r.created_at as role_created_at,
    r.updated_at as role_updated_at
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = user_id AND u.is_active = true;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_with_role(uuid) TO authenticated;