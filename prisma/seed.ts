import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { ApplicationStatus } from "../src/generated/prisma/enums";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as unknown as PrismaClient;

async function main() {
  console.log("🌱 Seeding database...\n");

  // ── Create a demo user ──────────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { email: "demo@careercrm.dev" },
    update: {},
    create: {
      email: "demo@careercrm.dev",
      name: "Alex Johnson",
      avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=AJ",
    },
  });

  console.log(`✅ Created user: ${user.name} (${user.email})`);

  // ── Seed 5 mock applications ────────────────────────────────────────
  const applications = [
    {
      companyName: "Google",
      roleTitle: "Senior Frontend Engineer",
      status: ApplicationStatus.INTERVIEW,
      appliedDate: new Date("2026-04-28"),
      notes:
        "Passed initial screen. On-site scheduled for May 20th. Focus on system design and React performance.",
      userId: user.id,
    },
    {
      companyName: "Stripe",
      roleTitle: "Full Stack Developer",
      status: ApplicationStatus.APPLIED,
      appliedDate: new Date("2026-05-10"),
      notes:
        "Applied via referral from David. Team works on payment infrastructure. Stack: TypeScript, React, Ruby.",
      userId: user.id,
    },
    {
      companyName: "Vercel",
      roleTitle: "Software Engineer — Next.js Core",
      status: ApplicationStatus.ASSESSMENT,
      appliedDate: new Date("2026-05-05"),
      notes:
        "Take-home assignment received. Build a dashboard component using App Router and Server Components. Due May 18.",
      userId: user.id,
    },
    {
      companyName: "Notion",
      roleTitle: "Product Engineer",
      status: ApplicationStatus.SAVED,
      appliedDate: null,
      notes:
        "Interesting role blending engineering and product thinking. Need to tailor resume before applying.",
      userId: user.id,
    },
    {
      companyName: "Shopify",
      roleTitle: "React Native Developer",
      status: ApplicationStatus.REJECTED,
      appliedDate: new Date("2026-04-15"),
      notes:
        "Rejected after second round. Feedback: more experience with native modules needed. Follow up in 6 months.",
      userId: user.id,
    },
  ];

  for (const app of applications) {
    const created = await prisma.application.create({ data: app });
    console.log(
      `  📋 ${created.companyName} — ${created.roleTitle} [${created.status}]`
    );
  }

  console.log(`\n🎉 Seeded ${applications.length} applications successfully.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
