import "dotenv/config";
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('🗑️  Resetting database...\n');

  try {
    
    console.log('Deleting route_legs...');
    await prisma.routeLeg.deleteMany({});
    
    console.log('Deleting routes...');
    await prisma.route.deleteMany({});
    
    console.log('Deleting driver_assign_cars...');
    await prisma.driverAssignCar.deleteMany({});
    
    console.log('Deleting passengers...');
    await prisma.passenger.deleteMany({});
    
    console.log('Deleting drivers...');
    await prisma.driver.deleteMany({});
    
    console.log('Deleting cars...');
    await prisma.car.deleteMany({});
    
    console.log('Deleting companies...');
    await prisma.company.deleteMany({});
    
    console.log('Deleting driver_configurations...');
    await prisma.driverConfiguration.deleteMany({});
    
    console.log('Deleting users...');
    await prisma.user.deleteMany({});
    
    console.log('Deleting roles...');
    await prisma.role.deleteMany({});

    console.log('\n✅ Database reset complete!');
    console.log('\n📊 All tables truncated:');
    console.log('   - roles');
    console.log('   - users');
    console.log('   - companies');
    console.log('   - cars');
    console.log('   - drivers');
    console.log('   - driver_assign_cars');
    console.log('   - passengers');
    console.log('   - driver_configurations');
    console.log('   - routes');
    console.log('   - route_legs');
    
  } catch (error) {
    console.error('\n❌ Error resetting database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
