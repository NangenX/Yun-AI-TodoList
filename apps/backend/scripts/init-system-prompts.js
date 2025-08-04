const { PrismaClient } = require('@prisma/client')

async function initSystemPrompts() {
  const prisma = new PrismaClient()

  try {
    console.log('开始初始化用户系统提示词字段...')

    // 更新所有 systemPrompts 为 null 的用户偏好设置
    const result = await prisma.userPreferences.updateMany({
      where: {
        systemPrompts: {
          equals: null,
        },
      },
      data: {
        systemPrompts: JSON.stringify([]),
      },
    })

    console.log(`成功初始化 ${result.count} 个用户的系统提示词字段`)
  } catch (error) {
    console.error('初始化系统提示词字段失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

initSystemPrompts()
