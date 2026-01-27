@@ .. @@
-- Insert default admin user (password: password123)
INSERT INTO users (id, email, password_hash, name, role_id, jurisdiction, is_active) VALUES
-  ('550e8400-e29b-41d4-a716-446655440010', 'admin@esigma.com', '$2b$10$rOvHPGkwQGKnlqshd.LfUeJ/Gf.xQ5cQNQfL8p8qGf.xQ5cQNQfL8', 'System Administrator', '550e8400-e29b-41d4-a716-446655440001', 'National', true),
-  ('550e8400-e29b-41d4-a716-446655440011', 'zo@esigma.com', '$2b$10$rOvHPGkwQGKnlqshd.LfUeJ/Gf.xQ5cQNQfL8p8qGf.xQ5cQNQfL8', 'Zonal Officer', '550e8400-e29b-41d4-a716-446655440002', 'North Zone', true),
-  ('550e8400-e29b-41d4-a716-446655440012', 'ro@esigma.com', '$2b$10$rOvHPGkwQGKnlqshd.LfUeJ/Gf.xQ5cQNQfL8p8qGf.xQ5cQNQfL8', 'Regional Officer', '550e8400-e29b-41d4-a716-446655440003', 'Delhi Region', true),
-  ('550e8400-e29b-41d4-a716-446655440013', 'supervisor@esigma.com', '$2b$10$rOvHPGkwQGKnlqshd.LfUeJ/Gf.xQ5cQNQfL8p8qGf.xQ5cQNQfL8', 'Field Supervisor', '550e8400-e29b-41d4-a716-446655440004', 'Central Delhi District', true),
-  ('550e8400-e29b-41d4-a716-446655440014', 'enumerator@esigma.com', '$2b$10$rOvHPGkwQGKnlqshd.LfUeJ/Gf.xQ5cQNQfL8p8qGf.xQ5cQNQfL8', 'Field Enumerator', '550e8400-e29b-41d4-a716-446655440005', 'Block A, Central Delhi', true)
+  ('550e8400-e29b-41d4-a716-446655440010', 'admin@esigma.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSforHgK', 'System Administrator', '550e8400-e29b-41d4-a716-446655440001', 'National', true),
+  ('550e8400-e29b-41d4-a716-446655440011', 'zo@esigma.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSforHgK', 'Zonal Officer', '550e8400-e29b-41d4-a716-446655440002', 'North Zone', true),
+  ('550e8400-e29b-41d4-a716-446655440012', 'ro@esigma.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSforHgK', 'Regional Officer', '550e8400-e29b-41d4-a716-446655440003', 'Delhi Region', true),
+  ('550e8400-e29b-41d4-a716-446655440013', 'supervisor@esigma.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSforHgK', 'Field Supervisor', '550e8400-e29b-41d4-a716-446655440004', 'Central Delhi District', true),
+  ('550e8400-e29b-41d4-a716-446655440014', 'enumerator@esigma.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSforHgK', 'Field Enumerator', '550e8400-e29b-41d4-a716-446655440005', 'Block A, Central Delhi', true)
ON CONFLICT (id) DO NOTHING;