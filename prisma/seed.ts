import "dotenv/config";
import { PrismaClient, SegmentKind, SegmentStatus } from "../src/generated/prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const generatePhone = () => `+92${Math.floor(3000000000 + Math.random() * 999999999)}`;
const generateEmergencyPhone = () => `+92${Math.floor(3000000000 + Math.random() * 999999999)}`;
const generateCarNo = () => `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${Math.floor(100 + Math.random() * 900)}`;
const generateEmail = (prefix: string, index: number) => `${prefix}${index + 1}@example.com`;

const companyNames = [
  "Nestle Pakistan", "Unilever Pakistan", "Engro Corporation", "Pakistan State Oil",
  "UBL Bank", "HBL Bank", "MCB Bank", "Allied Bank", "Bank Alfalah", "Meezan Bank",
  "Jazz (Mobilink)", "Telenor Pakistan", "Zong CMPak", "Ufone",
  "Pak Suzuki Motors", "Toyota Indus", "Honda Atlas", "Lucky Cement",
  "DG Khan Cement", "Maple Leaf Cement", "Bestway Cement", "Fauji Cement",
  "Packages Limited", "K-Electric", "SNGPL", "SSGC", "PTCL", "Nayatel",
  "Shaukat Khanum Hospital", "Aga Khan University Hospital", "Indus Hospital",
  "Systems Limited", "NETSOL Technologies", "TRG Pakistan", "Sofizar",
  "Lahore University of Management Sciences", "FAST National University",
  "University of Punjab", "Government College University", "Beaconhouse School System",
  "Packages Mall", "Emporium Mall", "Fortress Stadium", "Giga Mall",
  "Punjab Food Authority", "Punjab Police", "WAPDA", "PIA", "Pakistan Railways",
  "Sapphire Textiles", "Khaadi", "Gul Ahmed", "Alkaram Studio", "Junaid Jamshed",
  "Service Industries", "Interloop", "Sarena Textiles", "Rajby Industries",
  "Adamjee Insurance", "EFU Life", "Jubilee Life Insurance", "Askari Bank",
  "Fauji Fertilizer", "Fatima Fertilizer", "Engro Fertilizers",
  "Colgate-Palmolive Pakistan", "Procter & Gamble Pakistan", "GSK Pakistan",
  "Shell Pakistan", "Total PARCO", "Attock Petroleum", "Hascol Petroleum",
];

const driverNames = [
  "Muhammad Ahmed", "Ali Hassan", "Muhammad Usman", "Fahad Khan", "Bilal Ahmad",
  "Imran Ali", "Asif Mahmood", "Tariq Hussain", "Kamran Javed", "Nadeem Akhtar",
  "Rizwanullah", "Saeed Anwar", "Waqas Riaz", "Junaid Iqbal", "Shahid Masood",
  "Rashid Minhas", "Yasir Arafat", "Sohail Tanvir", "Amir Sohail", "Wasim Akram",
  "Inzamam-ul-Haq", "Misbah-ul-Haq", "Younis Khan", "Shahid Afridi",
  "Muhammad Hafeez", "Shoaib Malik", "Umar Akmal", "Kamran Akmal",
  "Azhar Ali", "Asad Shafiq", "Sarfaraz Ahmed", "Babar Azam",
  "Fakhar Zaman", "Hassan Ali", "Shaheen Afridi", "Haris Rauf",
  "Mohammad Rizwan", "Abdullah Shafique", "Imam-ul-Haq", "Salman Ali Agha",
];

const passengerNames = [
  "Fatima Zahra", "Ayesha Siddiqua", "Maryam Nawaz", "Hina Rabbani",
  "Bakhtawar Bhutto", "Asma Jahangir", "Malala Yousafzai", "Sanam Saeed",
  "Mahira Khan", "Mehwish Hayat", "Sajal Aly", "Mawra Hocane",
  "Urwa Hocane", "Ayeza Khan", "Sana Javed", "Maya Ali", "Sonya Hussain",
  "Iman Aly", "Zara Noor Abbas", "Hania Amir", "Iqra Aziz", "Yumna Zaidi",
  "Saba Qamar", "Nadia Khan", "Nida Yasir", "Juggan Kazim", "Fiza Ali",
  "Resham", "Reema Khan", "Meera", "Veena Malik", "Mathira", "Qandeel Baloch",
  "Muhammad Ali", "Imran Khan", "Nawaz Sharif", "Asif Zardari",
  "Shehbaz Sharif", "Bilawal Bhutto", "Pervez Musharraf", "Shahbaz Gill",
  "Fawad Chaudhry", "Sheikh Rasheed", "Chaudhry Nisar", "Jahangir Tareen",
  "Aleem Khan", "Yasmin Rashid", "Firdous Ashiq Awan", "Shireen Mazari",
  "Maryam Aurangzeb", "Marriyum Aurangzeb", "Hina Pervaiz Butt",
];

const lahoreLocations = [
  { name: "Johar Town", lat: 31.4697, long: 74.2726 },
  { name: "Emporium Mall", lat: 31.5024, long: 74.3356 },
  { name: "DHA Phase 5", lat: 31.4784, long: 74.3965 },
  { name: "Gulberg", lat: 31.5208, long: 74.3492 },
  { name: "Model Town", lat: 31.4739, long: 74.3142 },
  { name: "Bahria Town", lat: 31.4016, long: 74.1985 },
  { name: "Liberty Market", lat: 23.3522, long: 74.3895 },
  { name: "MM Alam Road", lat: 31.5234, long: 74.3571 },
  { name: "Allama Iqbal Town", lat: 31.5052, long: 74.2849 },
  { name: "Wapda Town", lat: 31.4104, long: 74.2562 },
  { name: "PIA Housing Society", lat: 31.4183, long: 74.2636 },
  { name: "Eden Gardens", lat: 31.3845, long: 74.2204 },
  { name: "Paragon City", lat: 31.3887, long: 74.2178 },
  { name: "Valencia Town", lat: 31.3956, long: 74.2389 },
  { name: "Lakshmi Chowk", lat: 31.5776, long: 74.3124 },
  { name: "Ichhra", lat: 31.5623, long: 74.3142 },
  { name: "Shadman", lat: 31.5489, long: 74.3298 },
  { name: "Township", lat: 31.4456, long: 74.2945 },
  { name: "Green Town", lat: 31.4589, long: 74.2789 },
  { name: "Ferozepur Road", lat: 31.5345, long: 74.3123 },
  { name: "Thokar Niaz Baig", lat: 31.4867, long: 74.2345 },
  { name: "Canal Road", lat: 31.5123, long: 74.3456 },
  { name: "Defence Road", lat: 31.4234, long: 74.2567 },
  { name: "Raiwind Road", lat: 31.3890, long: 74.1989 },
  { name: "Multan Road", lat: 31.4987, long: 74.3234 },
  { name: "Baghbanpura", lat: 31.5923, long: 74.3345 },
  { name: "Harbanspura", lat: 31.5789, long: 74.3567 },
  { name: "Barki Road", lat: 31.4678, long: 74.4567 },
  { name: "Cavalry Ground", lat: 31.4956, long: 74.4234 },
  { name: "Saddar Cantt", lat: 31.5123, long: 74.3876 },
  { name: "Fortress Stadium", lat: 31.5345, long: 74.3678 },
  { name: "Packages Mall", lat: 31.5156, long: 74.3345 },
  { name: "Amanah Mall", lat: 31.5234, long: 74.3123 },
  { name: "Anarkali Bazaar", lat: 31.5656, long: 74.3234 },
  { name: "Hall Road", lat: 31.5789, long: 74.3145 },
  { name: "Brandreth Road", lat: 31.5845, long: 74.3234 },
  { name: "Data Darbar", lat: 31.5789, long: 74.3034 },
  { name: "Badami Bagh", lat: 31.5945, long: 74.3345 },
  { name: "Shadbagh", lat: 31.5867, long: 74.3456 },
  { name: "Samanabad", lat: 31.5456, long: 74.3234 },
  { name: "Chauburji", lat: 31.5534, long: 74.3123 },
  { name: "Lahore Cantt Station", lat: 31.5623, long: 74.3345 },
  { name: "Jallo Park", lat: 31.5878, long: 74.4234 },
  { name: "GT Road", lat: 31.5234, long: 74.4234 },
  { name: "River View Society", lat: 31.5012, long: 74.4789 },
];

const addresses = [
  "123 Block A, Phase 1",
  "456 Block B, Phase 2",
  "789 Block C, Phase 3",
  "321 Block D, Sector 12",
  "654 Block E, Main Boulevard",
  "987 Block F, Defense Road",
  "147 Block G, Near Mall",
  "258 Block H, Canal View",
  "369 Block I, Walton Road",
  "741 Block J, Ghazi Road",
  "112 Block K, Scheme 5",
  "223 Block L, Wapda Town",
  "334 Block M, Eden Avenue",
  "445 Block N, Valencia Main",
  "556 Block O, Paragon Road",
  "667 Block P, Iqbal Town",
  "778 Block Q, College Road",
  "889 Block R, Raiwind",
  "990 Block S, Multan Road",
  "113 Block T, Ferozepur",
];

const carModels = ["Toyota Corolla", "Honda Civic", "Suzuki Alto", "Toyota Hilux", "Honda City", "Toyota Camry", "Suzuki Cultus", "Kia Sportage", "Hyundai Tucson", "MG HS", "Suzuki Swift", "Toyota Yaris", "Honda BR-V", "Toyota Fortuner", "Changan Alsvin", "Proton Saga", "Kia Picanto", "Hyundai Elantra", "Honda Accord", "Toyota Land Cruiser"];
const carColors = ["White", "Black", "Silver", "Gray", "Red", "Blue", "Green", "Gold", "Maroon", "Beige", "Pearl White", "Midnight Black", "Gunmetal Gray", "Navy Blue", "Burgundy"];

async function main() {
  console.log("🌱 Starting database seeding...");

  console.log("🧹 Cleaning up existing data...");
  await prisma.routeLeg.deleteMany({});
  await prisma.routeSegment.deleteMany({});
  await prisma.routeBatch.deleteMany({});
  await prisma.route.deleteMany({});
  await prisma.passenger.deleteMany({});
  await prisma.driverAssignCar.deleteMany({});
  await prisma.driver.deleteMany({});
  await prisma.car.deleteMany({});
  await prisma.company.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { not: "admin@falcon.com" } } });

  console.log("👤 Creating roles...");
  const roles = [{ name: "admin" }, { name: "driver" }, { name: "passenger" }, { name: "company" }];
  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      create: r,
      update: {},
    });
  }

  const adminRole = await prisma.role.findUnique({ where: { name: "admin" } });
  if (!adminRole) throw new Error("Admin role not found");
  const hashedPassword = await bcrypt.hash("admin@123", 10);
  await prisma.user.upsert({
    where: { email: "admin@falcon.com" },
    create: {
      email: "admin@falcon.com",
      password: hashedPassword,
      role_id: adminRole.id,
    },
    update: { password: hashedPassword },
  });

  console.log("🏢 Creating 40 companies...");
  const companies = [];
  for (let i = 0; i < 40; i++) {
    const city = lahoreLocations[i % lahoreLocations.length];
    const companyName = companyNames[i % companyNames.length];
    const company = await prisma.company.create({
      data: {
        name: companyName,
        email: `${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}@gmail.com`,
        phone_no: generatePhone(),
        address: `${addresses[i % addresses.length]}, ${city.name}`,
        lat: city.lat + (Math.random() - 0.5) * 0.1,
        long: city.long + (Math.random() - 0.5) * 0.1,
      },
    });
    companies.push(company);
  }

  console.log("🚗 Creating 40 cars...");
  const cars = [];
  for (let i = 0; i < 40; i++) {
    const carModel = carModels[i % carModels.length];
    const car = await prisma.car.create({
      data: {
        name: carModel,
        engine_capacity: `${1000 + Math.floor(Math.random() * 2000)}cc`,
        model: carModel,
        car_no: generateCarNo(),
        car_color: carColors[i % carColors.length],
        fuel_per_km: `${(5 + Math.random() * 10).toFixed(1)}L`,
        car_front_image_url: `https://example.com/cars/car_${i + 1}_front.jpg`,
        car_back_image_url: `https://example.com/cars/car_${i + 1}_back.jpg`,
        car_front_card_url: `https://example.com/cards/card_${i + 1}_front.jpg`,
        car_back_card_url: `https://example.com/cards/card_${i + 1}_back.jpg`,
      },
    });
    cars.push(car);
  }

  console.log("👨‍✈️ Creating 40 drivers...");
  const drivers = [];
  for (let i = 0; i < 40; i++) {
    const city = lahoreLocations[i % lahoreLocations.length];
    const driverName = driverNames[i % driverNames.length];
    const driver = await prisma.driver.create({
      data: {
        name: driverName,
        phone_no: generatePhone(),
        address: `${addresses[i % addresses.length]}, ${city.name}`,
        emergency_phone_no: generateEmergencyPhone(),
        driver_image_url: `https://example.com/drivers/driver_${i + 1}.jpg`,
        rate_per_km: 10 + Math.random() * 20,
        driver_cnic_front_url: `https://example.com/cnic/driver_${i + 1}_cnic_front.jpg`,
        driver_cnic_back_url: `https://example.com/cnic/driver_${i + 1}_cnic_back.jpg`,
        salary: `${30000 + Math.floor(Math.random() * 70000)} PKR`,
        driver_license_front_url: `https://example.com/license/driver_${i + 1}_license_front.jpg`,
        driver_license_back_url: `https://example.com/license/driver_${i + 1}_license_back.jpg`,
        is_available: Math.random() > 0.3,
        available_at: Math.random() > 0.5 ? new Date() : null,
        home_lat: city.lat + (Math.random() - 0.5) * 0.05,
        home_long: city.long + (Math.random() - 0.5) * 0.05,
      },
    });
    drivers.push(driver);
  }

  console.log("🔗 Assigning cars to drivers...");
  for (let i = 0; i < 40; i++) {
    await prisma.driverAssignCar.create({
      data: {
        driver_id: drivers[i].id,
        car_id: cars[i].id,
      },
    });
  }

  console.log("🧑‍💼 Creating 40 passengers...");
  const passengers = [];
  for (let i = 0; i < 40; i++) {
    const city = lahoreLocations[i % lahoreLocations.length];
    const passengerName = passengerNames[i % passengerNames.length];
    const passenger = await prisma.passenger.create({
      data: {
        name: passengerName,
        phone_no: generatePhone(),
        home_address: `${addresses[i % addresses.length]}, ${city.name}`,
        home_lat: city.lat + (Math.random() - 0.5) * 0.05,
        home_long: city.long + (Math.random() - 0.5) * 0.05,
        office_address: `${companies[i % companies.length].name} Office, ${city.name}`,
        office_lat: city.lat + (Math.random() - 0.5) * 0.08,
        office_long: city.long + (Math.random() - 0.5) * 0.08,
        company_id: companies[i % companies.length].id,
        pick_up_time: `${7 + Math.floor(Math.random() * 3)}:${Math.floor(Math.random() * 60).toString().padStart(2, "0")} AM`,
        drop_off_time: `${5 + Math.floor(Math.random() * 4)}:${Math.floor(Math.random() * 60).toString().padStart(2, "0")} PM`,
      },
    });
    passengers.push(passenger);
  }

  console.log("🛣️ Creating 40 routes...");
  const routes = [];
  for (let i = 0; i < 40; i++) {
    const city = lahoreLocations[i % lahoreLocations.length];
    const route = await prisma.route.create({
      data: {
        company_id: companies[i % companies.length].id,
        driver_id: drivers[i % drivers.length].id,
        office_address: `Office Hub ${i + 1}, ${city.name}`,
        office_lat: city.lat,
        office_long: city.long,
      },
    });
    routes.push(route);
  }

  console.log("📦 Creating route batches...");
  const batches = [];
  for (let i = 0; i < 40; i++) {
    const batch = await prisma.routeBatch.create({
      data: {
        route_id: routes[i].id,
        batch_order: 1,
      },
    });
    batches.push(batch);
  }

  console.log("📍 Creating route segments...");
  for (let i = 0; i < 40; i++) {
    await prisma.routeSegment.create({
      data: {
        route_id: routes[i].id,
        segment_order: 1,
        batch_id: batches[i].id,
        kind: SegmentKind.PICKUP_TO_OFFICE,
        status: SegmentStatus.PENDING,
      },
    });
  }

  console.log("🦵 Creating route legs...");
  for (let i = 0; i < 40; i++) {
    const passenger = passengers[i];
    await prisma.routeLeg.create({
      data: {
        route_id: routes[i].id,
        batch_id: batches[i].id,
        passenger_id: passenger.id,
        sequence: 1,
        drop_sequence: 1,
        pickup_address: passenger.home_address || "Home Address",
        pickup_lat: passenger.home_lat || 0,
        pickup_long: passenger.home_long || 0,
        pickup_time: passenger.pick_up_time || "08:00 AM",
        dropoff_address: passenger.office_address,
        dropoff_lat: passenger.office_lat || 0,
        dropoff_long: passenger.office_long || 0,
        dropoff_time: passenger.drop_off_time || "06:00 PM",
        toll_amount: Math.random() > 0.7 ? 50 + Math.floor(Math.random() * 200) : null,
      },
    });
  }

  console.log("⚙️ Creating driver configuration...");
  await prisma.driverConfiguration.upsert({
    where: { id: 1 },
    create: {
      availability_time: "06:00 AM",
      still_waiting_button_appear_in: "5 minutes",
      remaining_start_time: "15 minutes",
      passenger_waiting_time: "10 minutes",
      skip_button_appear_in: "3 minutes",
    },
    update: {},
  });

  console.log("✅ Seeding completed successfully!");
  console.log("📊 Summary:");
  console.log(`   - Roles: 4`);
  console.log(`   - Admin User: 1`);
  console.log(`   - Companies: ${companies.length}`);
  console.log(`   - Cars: ${cars.length}`);
  console.log(`   - Drivers: ${drivers.length}`);
  console.log(`   - Driver-Car Assignments: 40`);
  console.log(`   - Passengers: ${passengers.length}`);
  console.log(`   - Routes: ${routes.length}`);
  console.log(`   - Route Batches: ${batches.length}`);
  console.log(`   - Route Segments: 40`);
  console.log(`   - Route Legs: 40`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    prisma.$disconnect();
    process.exit(1);
  });
