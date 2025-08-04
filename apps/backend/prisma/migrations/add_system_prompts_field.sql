-- 为现有用户添加默认的 systemPrompts 字段
-- 这个迁移脚本确保所有现有用户都有一个空的系统提示词列表

UPDATE "UserPreferences" 
SET "systemPrompts" = '[]'::json 
WHERE "systemPrompts" IS NULL;

-- 添加注释说明字段用途
COMMENT ON COLUMN "UserPreferences"."systemPrompts" IS '用户自定义的系统提示词列表，存储为 JSON 格式';