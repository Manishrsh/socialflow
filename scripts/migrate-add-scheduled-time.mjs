import sql from '../lib/db.js';
async function migrate() {
  try {
    console.log('Adding scheduled_time column to calendar_events...');
    
    // Add the column
    await sql`
      ALTER TABLE calendar_events
      ADD COLUMN IF NOT EXISTS scheduled_time VARCHAR(5) DEFAULT '10:00'
    `;
    
    console.log('✓ Column scheduled_time added successfully');
    
    // Verify
    const verifyResult = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'calendar_events' AND column_name = 'scheduled_time'
    `;
    
    if (verifyResult.rows && verifyResult.rows.length > 0) {
      console.log('✓ Verification: Column exists with type', verifyResult.rows[0].data_type);
      process.exit(0);
    } else {
      console.log('✗ Column verification failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

migrate();
