import { db, pool, checkDatabaseHealth } from '../src/server/db/client';
import * as schema from '../src/server/db/schema';
import { hashPassword } from '../src/server/auth/session';

async function main() {
  console.log('🔄 Checking database connection...');
  const health = await checkDatabaseHealth();
  if (!health.ok) {
    console.warn('⚠️ MySQL not reachable currently:', health.message);
    console.log('ℹ️ GoShipping architecture includes an automatic in-memory service layer fallback for local development & zero-config testing.');
    process.exit(0);
  }

  console.log('🌱 Seeding database tables with initial enterprise records...');
  const defaultPasswordHash = await hashPassword('password');

  // Seed users
  await db.insert(schema.users).values([
    {
      id: 'usr-admin-01',
      email: 'admin@goshipping.com',
      passwordHash: defaultPasswordHash,
      fullName: 'Operations Director',
      role: 'super_admin',
      status: 'active'
    },
    {
      id: 'usr-ops-01',
      email: 'ops@goshipping.com',
      passwordHash: defaultPasswordHash,
      fullName: 'Kamal Hossain',
      role: 'ops_manager',
      status: 'active'
    },
    {
      id: 'usr-warehouse-01',
      email: 'warehouse@goshipping.com',
      passwordHash: defaultPasswordHash,
      fullName: 'Dhaka Hub Officer',
      role: 'warehouse_staff',
      status: 'active'
    },
    {
      id: 'usr-sales-01',
      email: 'sales@goshipping.com',
      passwordHash: defaultPasswordHash,
      fullName: 'Nafis Chowdhury',
      role: 'sales_team',
      status: 'active'
    },
    {
      id: 'usr-customer-01',
      email: 'client@apextextiles.com',
      passwordHash: defaultPasswordHash,
      fullName: 'Apex Textiles Ltd',
      role: 'customer',
      status: 'active'
    }
  ]).onDuplicateKeyUpdate({ target: schema.users.id, set: { status: 'active' } });

  console.log('✅ Database seeded successfully!');
  await pool.end();
}

main().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
