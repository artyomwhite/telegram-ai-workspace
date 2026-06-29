import { PrismaClient, TaskPriority, TaskStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Demo1234!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@businessassistant.app' },
    update: {},
    create: {
      email: 'demo@businessassistant.app',
      passwordHash,
      firstName: 'Demo',
      lastName: 'User',
    },
  });

  const companies = await Promise.all([
    prisma.company.upsert({
      where: { id: 'seed-company-1' },
      update: {},
      create: {
        id: 'seed-company-1',
        userId: user.id,
        name: 'Acme Corporation',
        industry: 'Technology',
        website: 'https://acme.example.com',
        email: 'contact@acme.example.com',
        phone: '+1-555-0100',
        description: 'Leading enterprise software provider',
      },
    }),
    prisma.company.upsert({
      where: { id: 'seed-company-2' },
      update: {},
      create: {
        id: 'seed-company-2',
        userId: user.id,
        name: 'Global Ventures Ltd',
        industry: 'Finance',
        website: 'https://globalventures.example.com',
        email: 'info@globalventures.example.com',
        phone: '+1-555-0200',
        description: 'International investment firm',
      },
    }),
    prisma.company.upsert({
      where: { id: 'seed-company-3' },
      update: {},
      create: {
        id: 'seed-company-3',
        userId: user.id,
        name: 'Sunrise Media',
        industry: 'Marketing',
        website: 'https://sunrisemedia.example.com',
        email: 'hello@sunrisemedia.example.com',
        description: 'Digital marketing agency',
      },
    }),
  ]);

  await Promise.all([
    prisma.contact.upsert({
      where: { id: 'seed-contact-1' },
      update: {},
      create: {
        id: 'seed-contact-1',
        userId: user.id,
        companyId: companies[0].id,
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.j@acme.example.com',
        phone: '+1-555-0101',
        position: 'CEO',
      },
    }),
    prisma.contact.upsert({
      where: { id: 'seed-contact-2' },
      update: {},
      create: {
        id: 'seed-contact-2',
        userId: user.id,
        companyId: companies[0].id,
        firstName: 'Michael',
        lastName: 'Chen',
        email: 'michael.c@acme.example.com',
        phone: '+1-555-0102',
        position: 'CTO',
      },
    }),
    prisma.contact.upsert({
      where: { id: 'seed-contact-3' },
      update: {},
      create: {
        id: 'seed-contact-3',
        userId: user.id,
        companyId: companies[1].id,
        firstName: 'Emily',
        lastName: 'Rodriguez',
        email: 'emily.r@globalventures.example.com',
        position: 'Managing Director',
      },
    }),
    prisma.contact.upsert({
      where: { id: 'seed-contact-4' },
      update: {},
      create: {
        id: 'seed-contact-4',
        userId: user.id,
        companyId: companies[2].id,
        firstName: 'David',
        lastName: 'Kim',
        email: 'david.k@sunrisemedia.example.com',
        position: 'Creative Director',
      },
    }),
  ]);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  await Promise.all([
    prisma.task.upsert({
      where: { id: 'seed-task-1' },
      update: {},
      create: {
        id: 'seed-task-1',
        userId: user.id,
        companyId: companies[0].id,
        title: 'Prepare Q3 sales report',
        description: 'Compile sales data and create presentation for board meeting',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        dueDate,
      },
    }),
    prisma.task.upsert({
      where: { id: 'seed-task-2' },
      update: {},
      create: {
        id: 'seed-task-2',
        userId: user.id,
        companyId: companies[1].id,
        title: 'Schedule investor call',
        description: 'Coordinate with Emily for quarterly investor update',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        dueDate,
      },
    }),
    prisma.task.upsert({
      where: { id: 'seed-task-3' },
      update: {},
      create: {
        id: 'seed-task-3',
        userId: user.id,
        companyId: companies[2].id,
        title: 'Review marketing campaign',
        status: TaskStatus.TODO,
        priority: TaskPriority.LOW,
      },
    }),
    prisma.task.upsert({
      where: { id: 'seed-task-4' },
      update: {},
      create: {
        id: 'seed-task-4',
        userId: user.id,
        title: 'Update CRM documentation',
        status: TaskStatus.COMPLETED,
        priority: TaskPriority.MEDIUM,
        completedAt: new Date(),
      },
    }),
  ]);

  const remindAt = new Date();
  remindAt.setDate(remindAt.getDate() + 3);

  await prisma.reminder.upsert({
    where: { id: 'seed-reminder-1' },
    update: {},
    create: {
      id: 'seed-reminder-1',
      userId: user.id,
      title: 'Follow up with Acme Corp',
      message: 'Check on Q3 report progress',
      remindAt,
    },
  });

  await prisma.note.upsert({
    where: { id: 'seed-note-1' },
    update: {},
    create: {
      id: 'seed-note-1',
      userId: user.id,
      title: 'Meeting Notes - Acme Kickoff',
      content:
        'Discussed partnership opportunities. Sarah interested in enterprise plan. Follow up next week.',
    },
  });

  console.log('Seed completed successfully');
  console.log('Demo user: demo@businessassistant.app / Demo1234!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
