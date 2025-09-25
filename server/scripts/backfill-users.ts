import { ReplitDBAdapter } from '../../lib/db/replit-db.js';
import { db as drizzleDB } from '../db.js';
import { users } from '@shared/schema';

async function backfillExistingUsers() {
  console.log('Starting user backfill from Replit DB to PostgreSQL...');

  try {
    // Get all users from Replit DB
    const replitDB = new ReplitDBAdapter();
    const replitUsers = await replitDB.getAllUsers();

    console.log(`Found ${replitUsers.length} users in Replit DB`);

    let synced = 0;
    let errors = 0;

    for (const replitUser of replitUsers) {
      try {
        await drizzleDB.insert(users).values({
          id: replitUser.id,
          email: replitUser.email,
          passwordHash: replitUser.passwordHash,
          createdAt: new Date(replitUser.createdAt),
          preferences: JSON.stringify(replitUser.preferences || { theme: 'light' })
        }).onConflictDoNothing();

        synced++;
        console.log(`✅ Synced user: ${replitUser.email}`);
      } catch (error) {
        errors++;
        console.error(`❌ Failed to sync user ${replitUser.email}:`, error);
      }
    }

    console.log(`\n📊 Backfill Results:`);
    console.log(`✅ Successfully synced: ${synced} users`);
    console.log(`❌ Errors: ${errors} users`);
    console.log(`✅ Backfill complete!`);

  } catch (error) {
    console.error('Backfill script failed:', error);
  }
}

// Run the script
backfillExistingUsers();