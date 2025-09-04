/*
  # Populate RBAC Roles and Menu Access

  1. New Data
    - Insert predefined roles with proper hierarchy levels
    - Configure menu access permissions for each role
    - Set up role descriptions and status

  2. Security
    - Maintain existing RLS policies
    - Ensure proper role hierarchy (1=highest, 6=lowest)

  3. Menu Access Configuration
    - Admin: Full system access
    - ZO User: Zone-level management
    - RO User: Regional management  
    - Supervisor: Team management
    - Enumerator: Test-taking access
*/

-- Insert roles with proper RBAC configuration
INSERT INTO roles (id, name, description, level, is_active, menu_access, created_at, updated_at) VALUES
(
  '550e8400-e29b-41d4-a716-446655440010',
  'Admin',
  'System Administrator with full access to all features',
  1,
  true,
  ARRAY['/dashboard', '/users', '/roles', '/role-menu-management', '/surveys', '/questions', '/results', '/enumerator-status', '/certificates', '/settings'],
  now(),
  now()
),
(
  '550e8400-e29b-41d4-a716-446655440011',
  'ZO User',
  'Zonal Office User with zone-level management access',
  2,
  true,
  ARRAY['/zo-dashboard', '/zone-performance', '/regional-overview', '/enumerator-status', '/results', '/certificates'],
  now(),
  now()
),
(
  '550e8400-e29b-41d4-a716-446655440012',
  'RO User',
  'Regional Office User with regional management access',
  3,
  true,
  ARRAY['/ro-dashboard', '/district-performance', '/supervisor-teams', '/enumerator-status', '/results', '/certificates'],
  now(),
  now()
),
(
  '550e8400-e29b-41d4-a716-446655440013',
  'Supervisor',
  'Field Supervisor with team management capabilities',
  4,
  true,
  ARRAY['/supervisor-dashboard', '/team-results', '/my-enumerators', '/assigned-surveys', '/enumerator-status', '/results', '/certificates'],
  now(),
  now()
),
(
  '550e8400-e29b-41d4-a716-446655440014',
  'Enumerator',
  'Field Enumerator with test-taking access',
  5,
  true,
  ARRAY['/enumerator-dashboard', '/available-tests', '/my-results', '/my-certificates', '/test-schedule', '/certificates'],
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  level = EXCLUDED.level,
  is_active = EXCLUDED.is_active,
  menu_access = EXCLUDED.menu_access,
  updated_at = now();