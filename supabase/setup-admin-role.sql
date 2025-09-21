-- Setup admin role for user
-- Replace 'your-user-id' with your actual user ID from the auth.users table

-- First, check if user_roles table exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'user_roles'
  ) THEN
    -- Create user_roles table if it doesn't exist
    CREATE TABLE user_roles (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'user')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      UNIQUE(user_id, role)
    );
    
    -- Enable RLS
    ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
    
    -- Create policies for user_roles
    CREATE POLICY "Users can view their own roles" 
    ON user_roles FOR SELECT 
    TO authenticated 
    USING (user_id = auth.uid());
    
    CREATE POLICY "Only admins can insert roles" 
    ON user_roles FOR INSERT 
    TO authenticated 
    USING (
      EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'
      )
    );
    
    CREATE POLICY "Only admins can update roles" 
    ON user_roles FOR UPDATE 
    TO authenticated 
    USING (
      EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'
      )
    );
    
    CREATE POLICY "Only admins can delete roles" 
    ON user_roles FOR DELETE 
    TO authenticated 
    USING (
      EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'
      )
    );
  END IF;
END $$;

-- Get your user ID from auth.users table
-- You can find this by checking your logged-in user in Supabase Dashboard
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- Once you have your user ID, uncomment and run this to make yourself an admin:
-- INSERT INTO user_roles (user_id, role) 
-- VALUES ('YOUR-USER-ID-HERE', 'admin')
-- ON CONFLICT (user_id, role) DO NOTHING;

-- Verify admin role was added
-- SELECT * FROM user_roles WHERE role = 'admin';