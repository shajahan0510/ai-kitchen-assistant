-- 🍽️ AI Kitchen Assistant — Database Schema
-- SQL for Supabase (PostgreSQL)
-- This file defines the complete database structure, security policies, and automation triggers.

-- ─── EXTENSIONS ───────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "moddatetime";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── TABLES ───────────────────────────────────────────────────────────────

-- 1. Profiles Table (Extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE,
  email       TEXT UNIQUE,
  role        TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  avatar_url  TEXT,
  bio         TEXT,
  preferences JSONB DEFAULT '{"diet": "All", "notifications": true}'::jsonb,
  subscription_tier TEXT DEFAULT 'free',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Recipes Table
CREATE TABLE IF NOT EXISTS public.recipes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cuisine       TEXT DEFAULT 'Global',
  title         TEXT NOT NULL,
  description   TEXT,
  image_url     TEXT,
  category      TEXT CHECK (category IN ('Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert')),
  tags          JSONB DEFAULT '[]',          -- e.g. ["Vegan", "Gluten-Free"]
  cooking_time  TEXT,
  servings      INTEGER DEFAULT 2,
  difficulty    TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  ingredients   JSONB NOT NULL DEFAULT '[]', -- List of ingredient strings
  steps         JSONB NOT NULL DEFAULT '[]', -- List of instruction strings
  nutrition     JSONB DEFAULT '{}',          -- {calories, protein, carbs, fat}
  views         INTEGER DEFAULT 0,
  likes         INTEGER DEFAULT 0,
  is_featured   BOOLEAN DEFAULT FALSE,
  is_ai_draft   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Meal Planner Table
CREATE TABLE IF NOT EXISTS public.meal_plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_id     UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
  planned_date  DATE NOT NULL,
  meal_type     TEXT CHECK (meal_type IN ('Breakfast', 'Lunch', 'Dinner', 'Snack')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Grocery Lists Table
CREATE TABLE IF NOT EXISTS public.grocery_lists (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  items                 JSONB NOT NULL DEFAULT '[]', -- [{name, checked, from_recipe}]
  generated_from_plan   BOOLEAN DEFAULT FALSE,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Audit Logs (Admin Actions)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID REFERENCES public.profiles(id),
  action      TEXT NOT NULL, -- e.g., 'DELETE_USER', 'DELETE_RECIPE'
  target_id   TEXT, -- String format to support different target types
  details     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Likes (Join Table for Recipes)
CREATE TABLE IF NOT EXISTS public.recipe_likes (
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_id  UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, recipe_id)
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_recipes_author    ON public.recipes(author_id);
CREATE INDEX IF NOT EXISTS idx_recipes_category  ON public.recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_trending  ON public.recipes(views DESC);
CREATE INDEX IF NOT EXISTS idx_planner_user_date ON public.meal_plans(user_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_audit_created     ON public.audit_logs(created_at DESC);

-- ─── ROW LEVEL SECURITY (RLS) ─────────────────────────────────────────────

-- Enable RLS
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_likes  ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Recipes Policies
DROP POLICY IF EXISTS "Recipes are viewable by everyone" ON public.recipes;
CREATE POLICY "Recipes are viewable by everyone" ON public.recipes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create recipes" ON public.recipes;
CREATE POLICY "Authenticated users can create recipes" ON public.recipes FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Owners or admins can update recipes" ON public.recipes;
CREATE POLICY "Owners or admins can update recipes" ON public.recipes FOR UPDATE USING (auth.uid() = author_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Owners or admins can delete recipes" ON public.recipes;
CREATE POLICY "Owners or admins can delete recipes" ON public.recipes FOR DELETE USING (auth.uid() = author_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Meal Plans Policies
DROP POLICY IF EXISTS "Users can manage own meal plans" ON public.meal_plans;
DROP POLICY IF EXISTS "Admins can manage all meal plans" ON public.meal_plans;
DROP POLICY IF EXISTS "Users can view own meal plans" ON public.meal_plans;
DROP POLICY IF EXISTS "Users can insert own meal plans" ON public.meal_plans;
DROP POLICY IF EXISTS "Users can update own meal plans" ON public.meal_plans;
DROP POLICY IF EXISTS "Users can delete own meal plans" ON public.meal_plans;

CREATE POLICY "Users can manage own meal plans" ON public.meal_plans FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all meal plans" ON public.meal_plans FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Grocery Lists Policies
DROP POLICY IF EXISTS "Users can manage own grocery list" ON public.grocery_lists;
DROP POLICY IF EXISTS "Admins can manage all grocery list" ON public.grocery_lists;
DROP POLICY IF EXISTS "Users can view own grocery list" ON public.grocery_lists;
DROP POLICY IF EXISTS "Users can insert own grocery list" ON public.grocery_lists;
DROP POLICY IF EXISTS "Users can update own grocery list" ON public.grocery_lists;
DROP POLICY IF EXISTS "Users can delete own grocery list" ON public.grocery_lists;

CREATE POLICY "Users can manage own grocery list" ON public.grocery_lists FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all grocery list" ON public.grocery_lists FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Audit Logs Policies
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Only admins can view audit logs" ON public.audit_logs FOR SELECT USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Likes Policies
DROP POLICY IF EXISTS "Users can view all likes" ON public.recipe_likes;
CREATE POLICY "Users can view all likes" ON public.recipe_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own likes" ON public.recipe_likes;
CREATE POLICY "Users can manage own likes" ON public.recipe_likes FOR ALL USING (auth.uid() = user_id);

-- ─── TRIGGERS & FUNCTIONS ─────────────────────────────────────────────────

-- 1. Updated At Triggers (Standard Maintenance)
DROP TRIGGER IF EXISTS handle_updated_at_profiles ON public.profiles;
CREATE TRIGGER handle_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

DROP TRIGGER IF EXISTS handle_updated_at_recipes ON public.recipes;
CREATE TRIGGER handle_updated_at_recipes BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

DROP TRIGGER IF EXISTS handle_updated_at_grocery_lists ON public.grocery_lists;
CREATE TRIGGER handle_updated_at_grocery_lists BEFORE UPDATE ON public.grocery_lists FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

-- 2. Recipe Like Trigger
CREATE OR REPLACE FUNCTION public.handle_recipe_like()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.recipes SET likes = likes + 1 WHERE id = NEW.recipe_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.recipes SET likes = CASE WHEN likes > 0 THEN likes - 1 ELSE 0 END WHERE id = OLD.recipe_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_recipe_like ON public.recipe_likes;
CREATE TRIGGER on_recipe_like
  AFTER INSERT OR DELETE ON public.recipe_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_recipe_like();

-- 3. Profile Auto-Creation Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── DIRECT MESSAGING TABLES ─────────────────────────────────────────────

-- 7. Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_message  TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Conversation Members
CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  joined_at       TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

-- 9. Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content         TEXT NOT NULL,
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SOCIAL FEED TABLES ───────────────────────────────────────────────────

-- 10. Posts (Social Feed)
CREATE TABLE IF NOT EXISTS public.posts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_id   UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  image_url   TEXT NOT NULL,
  caption     TEXT,
  likes_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Post Likes
CREATE TABLE IF NOT EXISTS public.post_likes (
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id     UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, post_id)
);

-- ─── PANTRY & STORAGE ──────────────────────────────────────────────────────

-- 12. Smart Pantry
CREATE TABLE IF NOT EXISTS public.pantry (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_name   TEXT NOT NULL,
  quantity    TEXT,
  expiry_date DATE,
  is_staple   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── GAMIFICATION & CHALLENGES ─────────────────────────────────────────────

-- 13. Weekly Challenges
CREATE TABLE IF NOT EXISTS public.weekly_challenges (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  description   TEXT,
  mystery_ingredients JSONB DEFAULT '[]', -- The "Mystery Box" ingredients
  start_date    DATE DEFAULT CURRENT_DATE,
  end_date      DATE DEFAULT (CURRENT_DATE + INTERVAL '7 days'),
  xp_reward     INTEGER DEFAULT 500,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Add XP and Rank to Profiles (Modify existing if needed, or add now)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rank_points INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unlocked_rewards JSONB DEFAULT '[]';
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS is_ai_draft BOOLEAN DEFAULT FALSE;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS cuisine TEXT DEFAULT 'Global';
ALTER TABLE public.grocery_lists ADD COLUMN IF NOT EXISTS generated_from_plan BOOLEAN DEFAULT FALSE;

-- ─── DM RLS POLICIES ──────────────────────────────────────────────────────
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Members can see their own conversation entries (Admins see ALL)
DROP POLICY IF EXISTS "Users can see own memberships" ON public.conversation_members;
CREATE POLICY "Users can see own memberships" 
ON public.conversation_members FOR SELECT 
USING (auth.uid() = user_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' OR auth.role() = 'service_role');

-- Anyone authenticated can initiate a conversation/invite
DROP POLICY IF EXISTS "Users can create memberships" ON public.conversation_members;
CREATE POLICY "Users can create memberships" 
ON public.conversation_members FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Service Role full access
DROP POLICY IF EXISTS "Service role full access on memberships" ON public.conversation_members;
CREATE POLICY "Service role full access on memberships" 
ON public.conversation_members FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Members can update their status (e.g. accept)
DROP POLICY IF EXISTS "Users can update own membership" ON public.conversation_members;
CREATE POLICY "Users can update own membership" 
ON public.conversation_members FOR UPDATE
USING (auth.uid() = user_id);

-- Anyone authenticated can start a conversation envelope
DROP POLICY IF EXISTS "Authenticated users can start conversations" ON public.conversations;
CREATE POLICY "Authenticated users can start conversations" 
ON public.conversations FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Admins and Service Role have full control
DROP POLICY IF EXISTS "Service and Admin full access on conversations" ON public.conversations;
CREATE POLICY "Service and Admin full access on conversations" 
ON public.conversations FOR ALL 
TO service_role, authenticated 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' OR auth.role() = 'service_role')
WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' OR auth.role() = 'service_role');

-- Members can update the conversation (for triggers updating last_message)
DROP POLICY IF EXISTS "Members can update conversations" ON public.conversations;
CREATE POLICY "Members can update conversations" 
ON public.conversations FOR UPDATE 
TO authenticated 
USING (
    EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = id AND user_id = auth.uid())
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = id AND user_id = auth.uid())
);

-- Members and Admins can see the conversation metadata
DROP POLICY IF EXISTS "Members can see conversations" ON public.conversations;
CREATE POLICY "Members can see conversations" 
ON public.conversations FOR SELECT 
USING (
    EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = id AND user_id = auth.uid())
    OR 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Only members and admins can read messages
DROP POLICY IF EXISTS "Members can read messages" ON public.messages;
CREATE POLICY "Members can read messages" 
ON public.messages FOR SELECT 
USING (
    EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = messages.conversation_id AND user_id = auth.uid())
    OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Only members can send messages (Admin can send to any chat)
DROP POLICY IF EXISTS "Members can send messages" ON public.messages;
CREATE POLICY "Members can send messages" 
ON public.messages FOR INSERT 
TO authenticated 
WITH CHECK (
    sender_id = auth.uid() AND (
        EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = messages.conversation_id AND user_id = auth.uid())
        OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
);

-- Service Role full access on messages
DROP POLICY IF EXISTS "Service role full access on messages" ON public.messages;
CREATE POLICY "Service role full access on messages" 
ON public.messages FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Only accepted members can read messages
-- The triggers and RPCs follow

-- Trigger to update 'last_message_at' in conversations
CREATE OR REPLACE FUNCTION public.update_conv_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations 
  SET last_message = LEFT(NEW.content, 50), 
      last_message_at = NOW() 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_new_message ON public.messages;
CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conv_last_message();

-- 10. Helper RPC to find existing conversation between two users
CREATE OR REPLACE FUNCTION public.get_conversation_between(uid1 UUID, uid2 UUID)
RETURNS SETOF public.conversations AS $$
BEGIN
  RETURN QUERY
  SELECT c.* FROM public.conversations c
  JOIN public.conversation_members cm1 ON c.id = cm1.conversation_id
  JOIN public.conversation_members cm2 ON c.id = cm2.conversation_id
  WHERE cm1.user_id = uid1 AND cm2.user_id = uid2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ─── EXTENDED RLS POLICIES ──────────────────────────────────────────────

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;

-- Posts Policies
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
CREATE POLICY "Authenticated users can create posts" ON public.posts FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Owners can manage own posts" ON public.posts;
CREATE POLICY "Owners can manage own posts" ON public.posts FOR ALL USING (auth.uid() = author_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Post Likes Policies
DROP POLICY IF EXISTS "Post likes are viewable by everyone" ON public.post_likes;
CREATE POLICY "Post likes are viewable by everyone" ON public.post_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own post likes" ON public.post_likes;
CREATE POLICY "Users can manage own post likes" ON public.post_likes FOR ALL USING (auth.uid() = user_id);

-- Pantry Policies
DROP POLICY IF EXISTS "Users can manage own pantry" ON public.pantry;
CREATE POLICY "Users can manage own pantry" ON public.pantry FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins and service_role can see all pantry" ON public.pantry;
CREATE POLICY "Admins and service_role can see all pantry" ON public.pantry FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Weekly Challenges Policies
DROP POLICY IF EXISTS "Challenges are viewable by everyone" ON public.weekly_challenges;
CREATE POLICY "Challenges are viewable by everyone" ON public.weekly_challenges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can manage challenges" ON public.weekly_challenges;
CREATE POLICY "Only admins can manage challenges" ON public.weekly_challenges FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- ─── SOCIAL FEED TRIGGERS ────────────────────────────────────────────────

-- Update likes count on posts
CREATE OR REPLACE FUNCTION public.handle_post_like()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.posts SET likes_count = CASE WHEN likes_count > 0 THEN likes_count - 1 ELSE 0 END WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_post_like ON public.post_likes;
CREATE TRIGGER on_post_like
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_post_like();
-- ─── GAMIFICATION FUNCTIONS ─────────────────────────────────────────────

-- Add XP to a user and handle rank progression logic
CREATE OR REPLACE FUNCTION public.add_user_xp(uid UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET xp = xp + amount
  WHERE id = uid;
  -- Add rank points (could be a more complex formula later)
  UPDATE public.profiles
  SET rank_points = rank_points + (amount / 10)
  WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── MISSING TABLES (referenced in code but not in schema) ──────────────────

-- 14. Follows (Social Follow System — used by social.js routes)
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower   ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following  ON public.follows(following_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON public.follows;
CREATE POLICY "Follows are viewable by everyone" ON public.follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own follows" ON public.follows;
CREATE POLICY "Users can manage own follows" ON public.follows FOR ALL TO authenticated USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);

-- ─── MISSING COLUMNS ────────────────────────────────────────────────────────

-- original_recipe_id on recipes (used by remix endpoint)
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS original_recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL;

-- difficulty on recipes (already in CHECK constraint but adding it explicitly)
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard'));

-- Make sure newer recipe columns exist on legacy tables
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS nutrition JSONB DEFAULT '{}';
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS servings INTEGER DEFAULT 2;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;

