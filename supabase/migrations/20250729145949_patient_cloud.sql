/*
  # Create get_user_with_role RPC function

  This function bypasses RLS policies to fetch user data with role information
  during authentication, preventing infinite recursion errors.

  ## Function Details
  - Returns user data with flattened role information
  - Uses SECURITY DEFINER to bypass RLS
  - Only returns active users
  - Used by AuthService.login to avoid RLS recursion
*/

CREATE OR REPLACE FUNCTION get_user_with_role(user_id uuid)
RETURNS TABLE (
  id uuid,
  email varchar(255),
  name varchar(255),
  role_id uuid,
  is_active boolean,
  jurisdiction varchar(255),
  zone varchar(255),
  region varchar(255),
  district varchar(255),
  employee_id varchar(100),
  phone_number varchar(20),
  profile_image text,
  parent_id uuid,
  last_login timestamptz,
  password_changed_at timestamptz,
  failed_login_attempts integer,
  locked_until timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  role_name varchar(50),
  role_description text,
  role_level integer,
  role_is_active boolean,
  menu_access text[]
)
SECURITY DEFINER
LANGUAGE sql
AS $$
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
    u.profile_image,
    u.parent_id,
    u.last_login,
    u.password_changed_at,
    u.failed_login_attempts,
    u.locked_until,
    u.created_at,
    u.updated_at,
    r.name as role_name,
    r.description as role_description,
    r.level as role_level,
    r.is_active as role_is_active,
    r.menu_access
  FROM users u
  LEFT JOIN roles r ON u.role_id = r.id
  WHERE u.id = user_id AND u.is_active = true;
$$;