// Run against production: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/update-caomingzhe-eval.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const caomingzhe = await prisma.user.findFirst({ where: { name: "曹铭哲" } });
  const chenglin = await prisma.user.findFirst({ where: { name: { contains: "承霖" } } });
  const cycle = await prisma.reviewCycle.findFirst({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
  });

  if (!caomingzhe || !chenglin || !cycle) {
    console.error("Missing data:", { caomingzhe: !!caomingzhe, chenglin: !!chenglin, cycle: !!cycle });
    process.exit(1);
  }

  console.log(`曹铭哲: ${caomingzhe.id}`);
  console.log(`承霖: ${chenglin.id}`);
  console.log(`Cycle: ${cycle.id} (${cycle.name})`);

  // 业绩产出: 4星, 个人能力(综合/学习/适应): 5星, 价值观(4个子维度): 5星
  // 加权总分: 4*0.5 + 5*0.3 + 5*0.2 = 2.0 + 1.5 + 1.0 = 4.5
  const result = await prisma.leaderFinalReview.upsert({
    where: {
      cycleId_employeeId_evaluatorId: {
        cycleId: cycle.id,
        employeeId: caomingzhe.id,
        evaluatorId: chenglin.id,
      },
    },
    update: {
      performanceStars: 4,
      performanceComment: "11-12由于入职时间短-上线特性未闭环。",
      abilityStars: 5,
      abilityComment: "整体学习能力和root初始氛围搭建不错。希望后续线上特性的优化能有一定的闭环推动，以及，带领ROOT梦之队在组织内发挥更大价值。",
      comprehensiveStars: 5,
      learningStars: 5,
      adaptabilityStars: 5,
      valuesStars: 5,
      valuesComment: "整体学习能力和root初始氛围搭建不错。",
      candidStars: 5,
      candidComment: "",
      progressStars: 5,
      progressComment: "",
      altruismStars: 5,
      altruismComment: "",
      rootStars: 5,
      rootComment: "",
      weightedScore: 4.5,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
    create: {
      cycleId: cycle.id,
      employeeId: caomingzhe.id,
      evaluatorId: chenglin.id,
      performanceStars: 4,
      performanceComment: "11-12由于入职时间短-上线特性未闭环。",
      abilityStars: 5,
      abilityComment: "整体学习能力和root初始氛围搭建不错。希望后续线上特性的优化能有一定的闭环推动，以及，带领ROOT梦之队在组织内发挥更大价值。",
      comprehensiveStars: 5,
      learningStars: 5,
      adaptabilityStars: 5,
      valuesStars: 5,
      valuesComment: "整体学习能力和root初始氛围搭建不错。",
      candidStars: 5,
      candidComment: "",
      progressStars: 5,
      progressComment: "",
      altruismStars: 5,
      altruismComment: "",
      rootStars: 5,
      rootComment: "",
      weightedScore: 4.5,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  console.log("Updated:", result.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
