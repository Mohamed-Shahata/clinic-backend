/**
 * prisma/seed.ts — Full Clinic CMS Seed
 * ─────────────────────────────────────
 *  1. Super-admin
 *  2. خطط الاشتراك
 *  3. عيادة Alpha — دكتور واحد (DOCTOR_ADMIN) + سيكريتيرة
 *  4. عيادة Beta  — اشتراك منتهي
 *  5. عيادة Gamma — موقوفة
 *  6. عيادة Delta — multi-doctor (DOCTOR_ADMIN + 2 DOCTOR) ← جديد
 *  7. كتالوج خدمات وأدوية وأشعة
 *  8. 60 مريض Alpha + 20 Beta + 30 Delta
 *  9. 200+ موعد (Alpha + Delta)
 * 10. روشتات وفواتير
 * 11. تقسيط ورواتب
 * 12. طلبات اشتراك / إشعارات / شكاوي / تقييمات / audit
 * 13. DoctorSettlement نماذج تسوية
 *
 * تشغيل: npx prisma db seed
 * reset كامل: npx prisma migrate reset  (يشغل الـ seed تلقائياً)
 * كلمة السر الموحدة: Password123!
 */

import "dotenv/config";
import {
  PrismaClient,
  AppointmentStatus,
  ClinicRole,
  ComplaintCategory,
  ComplaintStatus,
  InstallmentStatus,
} from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const PWD = "Password123!";
const ph = () => hash(PWD, 10);

// ── Helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setSeconds(0, 0);
  return d;
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setSeconds(0, 0);
  return d;
}
function todayAt(h: number, m = 0): Date {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}
function pastAt(daysBack: number, h: number, m = 0): Date {
  const d = daysAgo(daysBack);
  d.setHours(h, m, 0, 0);
  return d;
}
const pc = (n: number) => `P${String(n).padStart(4, "0")}`;
const rand = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱  بدء الـ seed …\n");

  // ══════════════════════════════════════════════════════════════════════════
  // 1. Super-Admin
  // ══════════════════════════════════════════════════════════════════════════
  const superAdmin = await prisma.user.upsert({
    where: { email: "super@demo.test" },
    update: { isSuperAdmin: true },
    create: {
      email: "super@demo.test",
      fullName: "مدير المنصة",
      passwordHash: await ph(),
      isSuperAdmin: true,
    },
  });
  console.log(`✅  Super-admin → ${superAdmin.email}`);

  // ══════════════════════════════════════════════════════════════════════════
  // 2. خطط الاشتراك
  // ══════════════════════════════════════════════════════════════════════════
  const planMonthly = await (prisma as any).subscriptionPlan.upsert({
    where: { code: "MONTHLY" },
    update: {},
    create: { code: "MONTHLY", name: "شهري", durationDays: 30, price: 299 },
  });
  const planSixMonths = await (prisma as any).subscriptionPlan.upsert({
    where: { code: "SIX_MONTHS" },
    update: {},
    create: {
      code: "SIX_MONTHS",
      name: "نصف سنوي",
      durationDays: 180,
      price: 1499,
    },
  });
  const planYearly = await (prisma as any).subscriptionPlan.upsert({
    where: { code: "YEARLY" },
    update: {},
    create: { code: "YEARLY", name: "سنوي", durationDays: 365, price: 2499 },
  });
  console.log("✅  خطط الاشتراك (3)");

  // ══════════════════════════════════════════════════════════════════════════
  // 3. عيادة Alpha — دكتور واحد نشطة
  // ══════════════════════════════════════════════════════════════════════════
  const clinicAlpha = await (prisma as any).clinic.upsert({
    where: { slug: "alpha-clinic" },
    update: { isActive: true },
    create: {
      slug: "alpha-clinic",
      name: "عيادة ألفا للباطنة",
      isActive: true,
      timezone: "Africa/Cairo",
      defaultLocale: "ar",
      workingHours: {
        sat: "9-17",
        sun: "9-17",
        mon: "9-17",
        tue: "9-17",
        wed: "9-17",
      },
    },
  });

  const drAlpha = await prisma.user.upsert({
    where: { email: "dr.alpha@demo.test" },
    update: {},
    create: {
      email: "dr.alpha@demo.test",
      phone: "+201001111111",
      fullName: "د. أحمد محمود السيد",
      passwordHash: await ph(),
    },
  });
  const recAlpha1 = await prisma.user.upsert({
    where: { email: "rec1.alpha@demo.test" },
    update: {},
    create: {
      email: "rec1.alpha@demo.test",
      phone: "+201002222222",
      fullName: "سارة إبراهيم عبدالله",
      passwordHash: await ph(),
    },
  });
  const recAlpha2 = await prisma.user.upsert({
    where: { email: "rec2.alpha@demo.test" },
    update: {},
    create: {
      email: "rec2.alpha@demo.test",
      phone: "+201003333333",
      fullName: "نورا خالد حسن",
      passwordHash: await ph(),
    },
  });

  await (prisma as any).clinicUser.upsert({
    where: {
      clinicId_userId: { clinicId: clinicAlpha.id, userId: drAlpha.id },
    },
    update: {},
    create: {
      clinicId: clinicAlpha.id,
      userId: drAlpha.id,
      role: ClinicRole.DOCTOR_ADMIN,
      specialty: "الباطنة والغدد الصماء",
      consultationFee: 300,
      followUpFee: 150,
      paymentMode: "PERCENTAGE",
      adminPercentage: 40,
      subscriptionPeriod: "YEARLY",
      isActive: true,
    },
  });
  const cuRec1 = await (prisma as any).clinicUser.upsert({
    where: {
      clinicId_userId: { clinicId: clinicAlpha.id, userId: recAlpha1.id },
    },
    update: {},
    create: {
      clinicId: clinicAlpha.id,
      userId: recAlpha1.id,
      role: ClinicRole.RECEPTIONIST,
      isActive: true,
    },
  });
  await (prisma as any).clinicUser.upsert({
    where: {
      clinicId_userId: { clinicId: clinicAlpha.id, userId: recAlpha2.id },
    },
    update: {},
    create: {
      clinicId: clinicAlpha.id,
      userId: recAlpha2.id,
      role: ClinicRole.RECEPTIONIST,
      isActive: false,
    },
  });

  await (prisma as any).clinicSubscription.upsert({
    where: { clinicId: clinicAlpha.id },
    update: {},
    create: {
      clinicId: clinicAlpha.id,
      planId: planYearly.id,
      startsAt: daysAgo(60),
      expiresAt: daysFromNow(305),
      status: "ACTIVE",
    },
  });
  console.log(`✅  عيادة Alpha → د. أحمد`);

  // ══════════════════════════════════════════════════════════════════════════
  // 4. عيادة Beta — اشتراك منتهي
  // ══════════════════════════════════════════════════════════════════════════
  const clinicBeta = await (prisma as any).clinic.upsert({
    where: { slug: "beta-clinic" },
    update: {},
    create: {
      slug: "beta-clinic",
      name: "عيادة بيتا لطب الأسنان",
      isActive: true,
      timezone: "Africa/Cairo",
      defaultLocale: "ar",
    },
  });
  const drBeta = await prisma.user.upsert({
    where: { email: "dr.beta@demo.test" },
    update: {},
    create: {
      email: "dr.beta@demo.test",
      phone: "+201004444444",
      fullName: "د. منى عبدالرحمن فؤاد",
      passwordHash: await ph(),
    },
  });
  const recBeta = await prisma.user.upsert({
    where: { email: "rec.beta@demo.test" },
    update: {},
    create: {
      email: "rec.beta@demo.test",
      phone: "+201005555555",
      fullName: "ريم حسام الدين",
      passwordHash: await ph(),
    },
  });
  await (prisma as any).clinicUser.upsert({
    where: { clinicId_userId: { clinicId: clinicBeta.id, userId: drBeta.id } },
    update: {},
    create: {
      clinicId: clinicBeta.id,
      userId: drBeta.id,
      role: ClinicRole.DOCTOR_ADMIN,
      specialty: "طب وجراحة الفم والأسنان",
      consultationFee: 500,
      followUpFee: 200,
      paymentMode: "FIXED_RENT",
      fixedMonthlyRent: 5000,
      subscriptionPeriod: "MONTHLY",
      isActive: true,
    },
  });
  await (prisma as any).clinicUser.upsert({
    where: { clinicId_userId: { clinicId: clinicBeta.id, userId: recBeta.id } },
    update: {},
    create: {
      clinicId: clinicBeta.id,
      userId: recBeta.id,
      role: ClinicRole.RECEPTIONIST,
      isActive: true,
    },
  });
  await (prisma as any).clinicSubscription.upsert({
    where: { clinicId: clinicBeta.id },
    update: {},
    create: {
      clinicId: clinicBeta.id,
      planId: planMonthly.id,
      startsAt: daysAgo(40),
      expiresAt: daysAgo(10),
      status: "EXPIRED",
    },
  });
  console.log(`✅  عيادة Beta → د. منى`);

  // ══════════════════════════════════════════════════════════════════════════
  // 5. عيادة Gamma — موقوفة
  // ══════════════════════════════════════════════════════════════════════════
  const clinicGamma = await (prisma as any).clinic.upsert({
    where: { slug: "gamma-clinic" },
    update: {},
    create: {
      slug: "gamma-clinic",
      name: "عيادة جاما للعيون",
      isActive: false,
    },
  });
  const drGamma = await prisma.user.upsert({
    where: { email: "dr.gamma@demo.test" },
    update: {},
    create: {
      email: "dr.gamma@demo.test",
      phone: "+201006666666",
      fullName: "د. طارق يوسف منصور",
      passwordHash: await ph(),
    },
  });
  await (prisma as any).clinicUser.upsert({
    where: {
      clinicId_userId: { clinicId: clinicGamma.id, userId: drGamma.id },
    },
    update: {},
    create: {
      clinicId: clinicGamma.id,
      userId: drGamma.id,
      role: ClinicRole.DOCTOR_ADMIN,
      isActive: true,
    },
  });
  console.log(`✅  عيادة Gamma → موقوفة`);

  // ══════════════════════════════════════════════════════════════════════════
  // 6. عيادة Delta — Multi-Doctor (جديد) ← المرحلة 2
  // ══════════════════════════════════════════════════════════════════════════
  const clinicDelta = await (prisma as any).clinic.upsert({
    where: { slug: "delta-clinic" },
    update: { isActive: true },
    create: {
      slug: "delta-clinic",
      name: "مركز دلتا الطبي",
      isActive: true,
      timezone: "Africa/Cairo",
      defaultLocale: "ar",
      workingHours: {
        sat: "8-20",
        sun: "8-20",
        mon: "8-20",
        tue: "8-20",
        wed: "8-20",
        thu: "8-14",
      },
    },
  });

  // صاحب المركز — DOCTOR_ADMIN (باطنة)
  const drDeltaAdmin = await prisma.user.upsert({
    where: { email: "dr.delta.admin@demo.test" },
    update: {},
    create: {
      email: "dr.delta.admin@demo.test",
      phone: "+201007777777",
      fullName: "د. كريم سامي العربي",
      passwordHash: await ph(),
    },
  });
  // دكتور عيون — DOCTOR بإيجار ثابت
  const drDeltaEye = await prisma.user.upsert({
    where: { email: "dr.delta.eye@demo.test" },
    update: {},
    create: {
      email: "dr.delta.eye@demo.test",
      phone: "+201008888888",
      fullName: "د. هالة فريد النجار",
      passwordHash: await ph(),
    },
  });
  // دكتور أطفال — DOCTOR بنسبة
  const drDeltaPeds = await prisma.user.upsert({
    where: { email: "dr.delta.peds@demo.test" },
    update: {},
    create: {
      email: "dr.delta.peds@demo.test",
      phone: "+201009999999",
      fullName: "د. سامر رضا الغزالي",
      passwordHash: await ph(),
    },
  });
  // سيكريتيرة المركز
  const recDelta = await prisma.user.upsert({
    where: { email: "rec.delta@demo.test" },
    update: {},
    create: {
      email: "rec.delta@demo.test",
      phone: "+201001234567",
      fullName: "إيمان وليد سليمان",
      passwordHash: await ph(),
    },
  });

  await (prisma as any).clinicUser.upsert({
    where: {
      clinicId_userId: { clinicId: clinicDelta.id, userId: drDeltaAdmin.id },
    },
    update: {},
    create: {
      clinicId: clinicDelta.id,
      userId: drDeltaAdmin.id,
      role: ClinicRole.DOCTOR_ADMIN,
      specialty: "الباطنة العامة",
      consultationFee: 400,
      followUpFee: 200,
      paymentMode: "PERCENTAGE",
      adminPercentage: 30,
      subscriptionPeriod: "YEARLY",
      isActive: true,
    },
  });
  await (prisma as any).clinicUser.upsert({
    where: {
      clinicId_userId: { clinicId: clinicDelta.id, userId: drDeltaEye.id },
    },
    update: {},
    create: {
      clinicId: clinicDelta.id,
      userId: drDeltaEye.id,
      role: ClinicRole.DOCTOR,
      specialty: "طب وجراحة العيون",
      consultationFee: 350,
      followUpFee: 150,
      paymentMode: "FIXED_RENT",
      fixedMonthlyRent: 8000,
      isActive: true,
    },
  });
  await (prisma as any).clinicUser.upsert({
    where: {
      clinicId_userId: { clinicId: clinicDelta.id, userId: drDeltaPeds.id },
    },
    update: {},
    create: {
      clinicId: clinicDelta.id,
      userId: drDeltaPeds.id,
      role: ClinicRole.DOCTOR,
      specialty: "طب الأطفال",
      consultationFee: 300,
      followUpFee: 150,
      paymentMode: "PERCENTAGE",
      adminPercentage: 25,
      isActive: true,
    },
  });
  await (prisma as any).clinicUser.upsert({
    where: {
      clinicId_userId: { clinicId: clinicDelta.id, userId: recDelta.id },
    },
    update: {},
    create: {
      clinicId: clinicDelta.id,
      userId: recDelta.id,
      role: ClinicRole.RECEPTIONIST,
      isActive: true,
    },
  });

  await (prisma as any).clinicSubscription.upsert({
    where: { clinicId: clinicDelta.id },
    update: {},
    create: {
      clinicId: clinicDelta.id,
      planId: planSixMonths.id,
      startsAt: daysAgo(30),
      expiresAt: daysFromNow(150),
      status: "ACTIVE",
    },
  });
  console.log(`✅  عيادة Delta (Multi-Doctor) → د. كريم + د. هالة + د. سامر`);

  // ══════════════════════════════════════════════════════════════════════════
  // 7. كتالوج الخدمات
  // ══════════════════════════════════════════════════════════════════════════
  const servicesAlpha = [
    { name: "كشف باطنة", price: 300, category: "كشف" },
    { name: "كشف متابعة", price: 150, category: "كشف" },
    { name: "تحليل سكر صائم", price: 80, category: "تحاليل" },
    { name: "تحليل وظائف كبد", price: 120, category: "تحاليل" },
    { name: "تحليل وظائف كلى", price: 120, category: "تحاليل" },
    { name: "صورة دم كاملة", price: 60, category: "تحاليل" },
    { name: "أشعة سينية صدر", price: 150, category: "أشعة" },
    { name: "موجات صوتية بطن", price: 250, category: "أشعة" },
    { name: "رسم قلب", price: 100, category: "إجراء" },
    { name: "قياس ضغط 24 ساعة", price: 400, category: "إجراء" },
  ];
  for (const s of servicesAlpha) {
    await (prisma as any).serviceCatalog
      .create({ data: { clinicId: clinicAlpha.id, ...s } })
      .catch(() => null);
  }

  const servicesBeta = [
    { name: "كشف أسنان", price: 500, category: "كشف" },
    { name: "تنظيف أسنان", price: 400, category: "تنظيف" },
    { name: "حشو ضرس عادي", price: 600, category: "حشوات" },
    { name: "حشو ضرس عصب", price: 1200, category: "حشوات" },
    { name: "خلع ضرس عادي", price: 300, category: "خلع" },
    { name: "خلع ضرس عقل", price: 800, category: "خلع" },
    { name: "تركيب تاج", price: 3500, category: "تركيبات" },
    { name: "تبييض أسنان", price: 2000, category: "تجميل" },
  ];
  for (const s of servicesBeta) {
    await (prisma as any).serviceCatalog
      .create({ data: { clinicId: clinicBeta.id, ...s } })
      .catch(() => null);
  }

  const servicesDelta = [
    { name: "كشف باطنة", price: 400, category: "كشف" },
    { name: "كشف عيون", price: 350, category: "كشف" },
    { name: "كشف أطفال", price: 300, category: "كشف" },
    { name: "قياس النظر", price: 100, category: "عيون" },
    { name: "فحص قاع العين", price: 200, category: "عيون" },
    { name: "تطعيمات الأطفال", price: 150, category: "أطفال" },
    { name: "متابعة نمو الطفل", price: 200, category: "أطفال" },
    { name: "موجات صوتية بطن", price: 250, category: "أشعة" },
  ];
  for (const s of servicesDelta) {
    await (prisma as any).serviceCatalog
      .create({ data: { clinicId: clinicDelta.id, ...s } })
      .catch(() => null);
  }
  console.log("✅  كتالوج الخدمات");

  // ══════════════════════════════════════════════════════════════════════════
  // 8. كتالوج الأدوية والأشعة
  // ══════════════════════════════════════════════════════════════════════════
  const medications = [
    {
      name: "ميتفورمين",
      dose: "500mg",
      frequency: "مرتين يومياً",
      duration: "مستمر",
      notes: "مع الأكل",
    },
    {
      name: "أملوديبين",
      dose: "5mg",
      frequency: "مرة يومياً",
      duration: "مستمر",
    },
    {
      name: "أتورفاستاتين",
      dose: "20mg",
      frequency: "مرة يومياً ليلاً",
      duration: "مستمر",
    },
    {
      name: "أوميبرازول",
      dose: "20mg",
      frequency: "مرة يومياً قبل الأكل",
      duration: "أسبوعان",
    },
    {
      name: "أموكسيسيلين",
      dose: "500mg",
      frequency: "3 مرات يومياً",
      duration: "7 أيام",
    },
    {
      name: "باراسيتامول",
      dose: "500mg",
      frequency: "عند اللزوم",
      duration: "حتى زوال الألم",
    },
    {
      name: "إيبوبروفين",
      dose: "400mg",
      frequency: "3 مرات يومياً",
      duration: "5 أيام",
      notes: "مع الأكل",
    },
    {
      name: "ليفوثيروكسين",
      dose: "50mcg",
      frequency: "مرة يومياً صائم",
      duration: "مستمر",
    },
    {
      name: "أملاح الحديد",
      dose: "150mg",
      frequency: "مرتين يومياً",
      duration: "3 أشهر",
    },
    {
      name: "فيتامين د3",
      dose: "50000IU",
      frequency: "أسبوعياً",
      duration: "شهرين",
    },
    {
      name: "أزيثروميسين",
      dose: "500mg",
      frequency: "مرة يومياً",
      duration: "3 أيام",
    },
    {
      name: "هيدروكلوروثيازيد",
      dose: "25mg",
      frequency: "مرة يومياً",
      duration: "مستمر",
    },
  ];
  for (const m of medications) {
    await (prisma as any).medicationCatalog
      .create({
        data: { clinicId: clinicAlpha.id, doctorId: drAlpha.id, ...m },
      })
      .catch(() => null);
    await (prisma as any).medicationCatalog
      .create({
        data: { clinicId: clinicDelta.id, doctorId: drDeltaAdmin.id, ...m },
      })
      .catch(() => null);
  }

  const imaging = [
    { name: "أشعة سينية صدر", category: "X-Ray" },
    { name: "موجات صوتية بطن كامل", category: "Ultrasound" },
    { name: "CT صدر", category: "CT Scan" },
    { name: "CT بطن وحوض بتباين", category: "CT Scan" },
    { name: "MRI رأس", category: "MRI" },
    { name: "قلب صدى", category: "Echo" },
    { name: "رسم قلب ECG", category: "ECG" },
    { name: "فحص قاع الشبكية", category: "Ophthalmology" },
  ];
  for (const img of imaging) {
    await (prisma as any).imagingCatalog
      .create({
        data: { clinicId: clinicAlpha.id, doctorId: drAlpha.id, ...img },
      })
      .catch(() => null);
    await (prisma as any).imagingCatalog
      .create({
        data: { clinicId: clinicDelta.id, doctorId: drDeltaAdmin.id, ...img },
      })
      .catch(() => null);
  }
  console.log("✅  كتالوج الأدوية والأشعة");

  // ══════════════════════════════════════════════════════════════════════════
  // 9. مرضى
  // ══════════════════════════════════════════════════════════════════════════
  const arabicNames = [
    "محمد أحمد عبدالله",
    "أحمد محمود حسن",
    "علي محمد سعيد",
    "عمر خالد إبراهيم",
    "يوسف طارق منصور",
    "حسن علي الشاذلي",
    "إبراهيم عمر فاروق",
    "خالد محمد عطية",
    "طارق حسين سلامة",
    "مصطفى رمضان عبدالحميد",
    "عبدالرحمن سامي نجيب",
    "هاني وائل صالح",
    "مروان فتحي رضوان",
    "وائل سمير العيسى",
    "رامي جمال يحيى",
    "سامي حمدي ثابت",
    "أيمن عبدالحميد كمال",
    "جمال عزت العزيز",
    "نبيل فريد سلمان",
    "عادل فوزي حلمي",
    "فاطمة محمد نور",
    "مريم أحمد الحسن",
    "زينب علي عمر",
    "نورا خالد رشيد",
    "هنا سعيد البكري",
    "دينا هشام غانم",
    "رنا عمر شوقي",
    "لمى وليد صبري",
    "أميرة طارق زكريا",
    "شيماء إبراهيم نصر",
    "هبة محمود كريم",
    "إيمان حسن ريان",
    "سمر أحمد بدوي",
    "نهى علي عمران",
    "دعاء عبدالله رفعت",
    "منى حسين قاسم",
    "أسماء يوسف حافظ",
    "رحمة مصطفى جابر",
    "نجوى جمال وهبة",
    "آية محمد الشهاوي",
    "كريم طارق البدري",
    "يحيى محمد الصاوي",
    "زياد عمرو فتحي",
    "ماهر هاني سعد",
    "لقاء سمير علي",
    "رغد أحمد صالح",
    "ميادة خالد سليم",
    "جنى وائل عباس",
    "حنين عبدالرحمن حجاج",
    "غادة محمد رجب",
    "إسلام حسام الدين",
    "عمار يوسف حسني",
    "بسمة طارق نصار",
    "ولاء أحمد ماضي",
    "تسنيم محمود جاد",
    "أروى خليل دياب",
    "روان عمر بهجت",
    "نادية حسن فرحان",
    "ياسمين سعيد ناصر",
    "صفاء محمد فايز",
  ];

  // Alpha patients (60)
  const patients: any[] = [];
  for (let i = 0; i < 60; i++) {
    const birthYear = randInt(1960, 2005);
    const existing = await (prisma as any).patient.findUnique({
      where: { clinicId_code: { clinicId: clinicAlpha.id, code: pc(i + 1) } },
    });
    const patient =
      existing ??
      (await (prisma as any).patient.create({
        data: {
          clinicId: clinicAlpha.id,
          createdById: drAlpha.id,
          code: pc(i + 1),
          fullName: arabicNames[i],
          phone: `+2010${String(i + 10000000).slice(1)}`,
          dateOfBirth: new Date(birthYear, randInt(0, 11), randInt(1, 28)),
          medicalNotes:
            i % 5 === 0
              ? "حساسية من البنسلين"
              : i % 5 === 1
                ? "مريض سكري نوع 2"
                : i % 5 === 2
                  ? "ضغط دم مرتفع"
                  : i % 7 === 0
                    ? "مريض قلب"
                    : null,
        },
      }));
    patients.push(patient);
  }
  console.log(`✅  ${patients.length} مريض — Alpha`);

  // Beta patients (20)
  const betaPatients: any[] = [];
  for (let i = 0; i < 20; i++) {
    const existing = await (prisma as any).patient.findUnique({
      where: { clinicId_code: { clinicId: clinicBeta.id, code: pc(i + 1) } },
    });
    const p =
      existing ??
      (await (prisma as any).patient.create({
        data: {
          clinicId: clinicBeta.id,
          createdById: drBeta.id,
          code: pc(i + 1),
          fullName: arabicNames[i + 20],
          phone: `+2011${String(i + 10000000).slice(1)}`,
          medicalNotes: i % 3 === 0 ? "حساسية من اللاتكس" : null,
        },
      }));
    betaPatients.push(p);
  }
  console.log(`✅  ${betaPatients.length} مريض — Beta`);

  // Delta patients (30) — موزعين على 3 أطباء
  const deltaPatients: any[] = [];
  for (let i = 0; i < 30; i++) {
    const existing = await (prisma as any).patient.findUnique({
      where: { clinicId_code: { clinicId: clinicDelta.id, code: pc(i + 1) } },
    });
    const p =
      existing ??
      (await (prisma as any).patient.create({
        data: {
          clinicId: clinicDelta.id,
          createdById: recDelta.id,
          code: pc(i + 1),
          fullName: arabicNames[i + 30],
          phone: `+2012${String(i + 10000000).slice(1)}`,
          medicalNotes: i % 4 === 0 ? "حساسية من البنسلين" : null,
        },
      }));
    deltaPatients.push(p);
  }
  console.log(`✅  ${deltaPatients.length} مريض — Delta`);

  // ══════════════════════════════════════════════════════════════════════════
  // 10. مواعيد Alpha
  // ══════════════════════════════════════════════════════════════════════════
  const visitTypes = ["NEW_VISIT", "FOLLOW_UP", "EMERGENCY", "CONSULTATION"];
  const allAppts: any[] = [];

  for (let day = 1; day <= 60; day++) {
    const numAppts = randInt(2, 5);
    for (let j = 0; j < numAppts; j++) {
      const patient = patients[randInt(0, patients.length - 1)];
      const hour = randInt(9, 17);
      const status = Math.random() < 0.85 ? "COMPLETED" : "CANCELLED";
      const appt = await (prisma as any).appointment.create({
        data: {
          clinicId: clinicAlpha.id,
          patientId: patient.id,
          doctorId: drAlpha.id,
          startsAt: pastAt(day, hour),
          endsAt: pastAt(day, hour + 1),
          status,
          visitType: rand(visitTypes),
          notes:
            j % 3 === 0
              ? "مريض يشكو من ألم في الصدر"
              : j % 3 === 1
                ? "متابعة سكر"
                : null,
        },
      });
      allAppts.push(appt);
    }
  }

  const todayStatuses: AppointmentStatus[] = [
    "COMPLETED",
    "COMPLETED",
    "IN_PROGRESS",
    "IN_QUEUE",
    "IN_QUEUE",
    "IN_QUEUE",
  ];
  for (let i = 0; i < 6; i++) {
    const appt = await (prisma as any).appointment.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: patients[i].id,
        doctorId: drAlpha.id,
        startsAt: todayAt(9 + i),
        endsAt: todayAt(10 + i),
        status: todayStatuses[i],
        visitType: i < 2 ? "FOLLOW_UP" : "NEW_VISIT",
      },
    });
    allAppts.push(appt);
  }

  for (let day = 1; day <= 14; day++) {
    const numAppts = randInt(1, 4);
    for (let j = 0; j < numAppts; j++) {
      const patient = patients[randInt(0, patients.length - 1)];
      const hour = randInt(9, 16);
      const appt = await (prisma as any).appointment.create({
        data: {
          clinicId: clinicAlpha.id,
          patientId: patient.id,
          doctorId: drAlpha.id,
          startsAt: (() => {
            const d = daysFromNow(day);
            d.setHours(hour, 0, 0, 0);
            return d;
          })(),
          endsAt: (() => {
            const d = daysFromNow(day);
            d.setHours(hour + 1, 0, 0, 0);
            return d;
          })(),
          status: "IN_QUEUE",
          visitType: rand(visitTypes),
        },
      });
      allAppts.push(appt);
    }
  }

  const completedAppts = allAppts.filter((a) => a.status === "COMPLETED");
  console.log(
    `✅  ${allAppts.length} موعد (${completedAppts.length} مكتمل) — Alpha`,
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 11. مواعيد Delta — موزعة على 3 أطباء
  // ══════════════════════════════════════════════════════════════════════════
  const deltaDocIds = [drDeltaAdmin.id, drDeltaEye.id, drDeltaPeds.id];
  const deltaAppts: any[] = [];

  for (let day = 1; day <= 30; day++) {
    for (const doctorId of deltaDocIds) {
      const numAppts = randInt(1, 3);
      for (let j = 0; j < numAppts; j++) {
        const patient = deltaPatients[randInt(0, deltaPatients.length - 1)];
        const hour = randInt(8, 19);
        const status = Math.random() < 0.82 ? "COMPLETED" : "CANCELLED";
        const appt = await (prisma as any).appointment.create({
          data: {
            clinicId: clinicDelta.id,
            patientId: patient.id,
            doctorId,
            startsAt: pastAt(day, hour),
            endsAt: pastAt(day, hour + 1),
            status,
            visitType: rand(visitTypes),
          },
        });
        deltaAppts.push(appt);
      }
    }
  }

  // مواعيد اليوم في Delta
  for (let i = 0; i < 9; i++) {
    const doctorId = deltaDocIds[i % 3];
    const appt = await (prisma as any).appointment.create({
      data: {
        clinicId: clinicDelta.id,
        patientId: deltaPatients[i].id,
        doctorId,
        startsAt: todayAt(9 + Math.floor(i / 3) * 2),
        endsAt: todayAt(10 + Math.floor(i / 3) * 2),
        status: i < 3 ? "COMPLETED" : i < 6 ? "IN_PROGRESS" : "IN_QUEUE",
        visitType: "NEW_VISIT",
      },
    });
    deltaAppts.push(appt);
  }

  const deltaCompleted = deltaAppts.filter((a) => a.status === "COMPLETED");
  console.log(
    `✅  ${deltaAppts.length} موعد (${deltaCompleted.length} مكتمل) — Delta`,
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 12. روشتات (Alpha)
  // ══════════════════════════════════════════════════════════════════════════
  const diagnosisList = [
    "ارتفاع ضغط الدم",
    "سكري نوع 2",
    "خمول الغدة الدرقية",
    "التهاب المعدة",
    "ارتفاع الكوليسترول",
    "فقر الدم",
    "التهاب الجهاز التنفسي العلوي",
    "نقص فيتامين د",
    "حمى",
    "التهاب اللوزتين",
  ];
  let rxCount = 0;
  for (const appt of completedAppts.slice(0, 80)) {
    if (Math.random() < 0.75) {
      const numMeds = randInt(1, 4);
      const meds = Array.from({ length: numMeds }, () => ({
        name: medications[randInt(0, medications.length - 1)].name,
        dose: rand(["500mg", "250mg", "20mg", "10mg", "5mg"]),
        frequency: rand(["مرة يومياً", "مرتين يومياً", "3 مرات يومياً"]),
        duration: rand(["7 أيام", "أسبوعان", "شهر", "مستمر"]),
      }));
      await (prisma as any).prescription
        .create({
          data: {
            clinicId: clinicAlpha.id,
            patientId: appt.patientId,
            doctorId: drAlpha.id,
            appointmentId: appt.id,
            diagnosis: rand(diagnosisList),
            medications: meds,
            issuedAt: appt.startsAt,
          },
        })
        .catch(() => null);
      rxCount++;
    }
  }
  console.log(`✅  ${rxCount} روشتة — Alpha`);

  // ══════════════════════════════════════════════════════════════════════════
  // 13. فواتير (Alpha)
  // ══════════════════════════════════════════════════════════════════════════
  const paymentMethods = ["cash", "vodafone_cash", "transfer", "insurance"];
  let invoiceCount = 0;
  for (const appt of completedAppts.slice(0, 70)) {
    const isFollowUp = appt.visitType === "FOLLOW_UP";
    const fee = isFollowUp ? 150 : 300;
    const extraService = Math.random() < 0.4;
    const total = fee + (extraService ? randInt(60, 400) : 0);
    const services = [
      { name: isFollowUp ? "كشف متابعة" : "كشف باطنة", price: fee, qty: 1 },
      ...(extraService
        ? [
            {
              name: rand(["تحليل سكر", "موجات صوتية", "رسم قلب"]),
              price: total - fee,
              qty: 1,
            },
          ]
        : []),
    ];
    await (prisma as any).invoice
      .create({
        data: {
          clinicId: clinicAlpha.id,
          patientId: appt.patientId,
          appointmentId: appt.id,
          issuedById: rand([drAlpha.id, recAlpha1.id]),
          totalAmount: total,
          paidAmount: Math.random() < 0.8 ? total : 0,
          paymentMethod: rand(paymentMethods),
          status: Math.random() < 0.8 ? "PAID" : "PENDING",
          services,
          createdAt: appt.startsAt,
        },
      })
      .catch(() => null);
    invoiceCount++;
  }
  console.log(`✅  ${invoiceCount} فاتورة — Alpha`);

  // فواتير Delta (موزعة على 3 أطباء)
  let deltaInvoiceCount = 0;
  for (const appt of deltaCompleted.slice(0, 50)) {
    const fee =
      appt.doctorId === drDeltaEye.id
        ? 350
        : appt.doctorId === drDeltaPeds.id
          ? 300
          : 400;
    await (prisma as any).invoice
      .create({
        data: {
          clinicId: clinicDelta.id,
          patientId: appt.patientId,
          appointmentId: appt.id,
          issuedById: rand([recDelta.id, appt.doctorId]),
          totalAmount: fee,
          paidAmount: fee,
          paymentMethod: rand(paymentMethods),
          status: "PAID",
          services: [{ name: "كشف", price: fee, qty: 1 }],
          createdAt: appt.startsAt,
        },
      })
      .catch(() => null);
    deltaInvoiceCount++;
  }
  console.log(`✅  ${deltaInvoiceCount} فاتورة — Delta`);

  // ══════════════════════════════════════════════════════════════════════════
  // 14. DoctorSettlement نماذج تسوية لـ Delta — الشهر الماضي
  // ══════════════════════════════════════════════════════════════════════════
  const now = new Date();
  const prevMonthNum = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevMonthYear =
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const prevMonthStr = `${prevMonthYear}-${String(prevMonthNum).padStart(2, "0")}`;

  // تسوية د. هالة (عيون) — مدفوعة كاملة
  await prisma.$executeRaw`
    INSERT INTO "DoctorSettlement" (id, "clinicId", "doctorUserId", month, "totalRevenue", "clinicShare", "doctorNet", status, "paidAmount", "paymentMethod", notes, "paidAt", "createdAt", "updatedAt")
    VALUES (
      ${`${clinicDelta.id}-${drDeltaEye.id}-${prevMonthStr}`},
      ${clinicDelta.id}, ${drDeltaEye.id}, ${prevMonthStr},
      12000, 8000, 4000,
      'PAID', 8000, 'cash', 'تم الاستلام نقداً',
      ${daysAgo(5)}, ${daysAgo(7)}, ${daysAgo(5)}
    )
    ON CONFLICT ("clinicId", "doctorUserId", month) DO NOTHING
  `;

  // تسوية د. سامر (أطفال) — جزئية
  await prisma.$executeRaw`
    INSERT INTO "DoctorSettlement" (id, "clinicId", "doctorUserId", month, "totalRevenue", "clinicShare", "doctorNet", status, "paidAmount", "paymentMethod", notes, "paidAt", "createdAt", "updatedAt")
    VALUES (
      ${`${clinicDelta.id}-${drDeltaPeds.id}-${prevMonthStr}`},
      ${clinicDelta.id}, ${drDeltaPeds.id}, ${prevMonthStr},
      8000, 2000, 6000,
      'PARTIAL', 1000, 'transfer', 'دفع جزء — الباقي الأسبوع القادم',
      ${daysAgo(3)}, ${daysAgo(7)}, ${daysAgo(3)}
    )
    ON CONFLICT ("clinicId", "doctorUserId", month) DO NOTHING
  `;
  console.log("✅  نماذج DoctorSettlement — Delta");

  // ══════════════════════════════════════════════════════════════════════════
  // 15. تقسيط ورواتب
  // ══════════════════════════════════════════════════════════════════════════
  const installmentTitles = [
    "عملية ضرس العقل",
    "حشو عصب أمامي",
    "تقويم الفك",
    "زراعة ضرسين",
    "إجراء قلبي",
    "علاج كيماوي دعامة",
    "متابعة سكر ربع سنوي",
    "تحاليل دورية",
    "ملف متكامل",
    "إجراء عيون",
    "علاج أطفال مزمن",
    "خطة تعافي كاملة",
  ];
  for (let i = 0; i < 12; i++) {
    const patient = patients[i * 5];
    const total = randInt(1000, 15000);
    const paidSoFar = i < 4 ? 0 : i < 8 ? randInt(300, total - 100) : total;
    const status: InstallmentStatus =
      paidSoFar === 0 ? "PENDING" : paidSoFar >= total ? "PAID" : "PARTIAL";
    const plan = await (prisma as any).installmentPlan.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: patient.id,
        appointmentId:
          completedAppts.find((a) => a.patientId === patient.id)?.id ?? null,
        createdById: rand([drAlpha.id, recAlpha1.id]),
        title: installmentTitles[i],
        totalAmount: total,
        paidAmount: paidSoFar,
        status,
        createdAt: daysAgo(randInt(5, 60)),
      },
    });
    if (paidSoFar > 0) {
      const numPayments = status === "PAID" ? randInt(2, 4) : randInt(1, 2);
      const perPayment = Math.floor(paidSoFar / numPayments);
      for (let p = 0; p < numPayments; p++) {
        await (prisma as any).installmentPayment
          .create({
            data: {
              planId: plan.id,
              amount:
                p === numPayments - 1
                  ? paidSoFar - perPayment * (numPayments - 1)
                  : perPayment,
              note: `دفعة ${p + 1}`,
              paidAt: daysAgo(randInt(1, 50)),
              recordedBy: recAlpha1.id,
            },
          })
          .catch(() => null);
      }
    }
  }

  const salary = await (prisma as any).staffSalary
    .create({
      data: {
        clinicId: clinicAlpha.id,
        clinicUserId: cuRec1.id,
        monthlyAmount: 3500,
        effectiveFrom: daysAgo(180),
        isActive: true,
      },
    })
    .catch(() => null);
  if (salary) {
    for (let m = 1; m <= 5; m++) {
      await (prisma as any).salaryPayment
        .create({
          data: {
            salaryId: salary.id,
            clinicId: clinicAlpha.id,
            amount: 3500,
            paidAt: daysAgo(m * 30),
            note: `راتب شهر ${m}`,
            paidById: drAlpha.id,
          },
        })
        .catch(() => null);
    }
  }
  console.log("✅  تقسيط ورواتب");

  // ══════════════════════════════════════════════════════════════════════════
  // 16. طلبات الاشتراك
  // ══════════════════════════════════════════════════════════════════════════
  await (prisma as any).subscriptionPaymentRequest
    .create({
      data: {
        clinicId: clinicBeta.id,
        planId: planSixMonths.id,
        requestedById: drBeta.id,
        transferPhone: "01234567890",
        screenshotUrl: "https://placehold.co/400x300?text=Transfer",
        notes: "تحويل على فودافون كاش",
        status: "PENDING",
      },
    })
    .catch(() => null);
  await (prisma as any).subscriptionPaymentRequest
    .create({
      data: {
        clinicId: clinicAlpha.id,
        planId: planYearly.id,
        requestedById: drAlpha.id,
        transferPhone: "01098765432",
        screenshotUrl: "https://placehold.co/400x300?text=Approved",
        status: "APPROVED",
        reviewedById: superAdmin.id,
        reviewedAt: daysAgo(5),
      },
    })
    .catch(() => null);
  await (prisma as any).subscriptionPaymentRequest
    .create({
      data: {
        clinicId: clinicGamma.id,
        planId: planMonthly.id,
        requestedById: drGamma.id,
        transferPhone: "01512345678",
        screenshotUrl: "https://placehold.co/400x300?text=Rejected",
        status: "REJECTED",
        reviewedById: superAdmin.id,
        reviewedAt: daysAgo(3),
        rejectionReason: "الصورة غير واضحة",
      },
    })
    .catch(() => null);
  await (prisma as any).subscriptionPaymentRequest
    .create({
      data: {
        clinicId: clinicDelta.id,
        planId: planSixMonths.id,
        requestedById: drDeltaAdmin.id,
        transferPhone: "01112223344",
        screenshotUrl: "https://placehold.co/400x300?text=Delta+Payment",
        status: "APPROVED",
        reviewedById: superAdmin.id,
        reviewedAt: daysAgo(2),
      },
    })
    .catch(() => null);
  console.log("✅  طلبات اشتراك (4)");

  // ══════════════════════════════════════════════════════════════════════════
  // 17. إشعارات
  // ══════════════════════════════════════════════════════════════════════════
  const notifications = [
    {
      userId: drAlpha.id,
      type: "SUBSCRIPTION_APPROVED",
      title: "تم تجديد اشتراكك",
      body: "تم تجديد اشتراك عيادة ألفا لمدة سنة.",
      isRead: true,
    },
    {
      userId: drAlpha.id,
      type: "PATIENT_REMINDER",
      title: "تذكير: 6 مرضى اليوم",
      body: "عندك 6 مرضى محجوزين اليوم.",
      isRead: false,
    },
    {
      userId: drBeta.id,
      type: "SUBSCRIPTION_EXPIRED",
      title: "انتهى اشتراكك",
      body: "انتهى اشتراك عيادة بيتا. جدد الآن.",
      isRead: false,
    },
    {
      userId: drDeltaAdmin.id,
      type: "SUBSCRIPTION_APPROVED",
      title: "تم تجديد اشتراك المركز",
      body: "تم تجديد اشتراك مركز دلتا الطبي.",
      isRead: false,
    },
    {
      userId: drDeltaEye.id,
      type: "SETTLEMENT_RECORDED",
      title: "تم تسجيل دفعة التسوية",
      body: "تم تسجيل دفعة إيجار شهر " + prevMonthStr,
      isRead: false,
    },
    {
      userId: drDeltaPeds.id,
      type: "SETTLEMENT_PARTIAL",
      title: "تسوية جزئية مسجلة",
      body: "تم تسجيل دفعة جزئية 1000 جنيه من تسوية شهر " + prevMonthStr,
      isRead: false,
    },
    {
      userId: recAlpha1.id,
      type: "APPOINTMENT_REMINDER",
      title: "مريض جديد في الطابور",
      body: "تم إضافة مريض جديد لطابور اليوم.",
      isRead: true,
    },
    {
      userId: recDelta.id,
      type: "APPOINTMENT_REMINDER",
      title: "9 مواعيد اليوم",
      body: "يوجد 9 مواعيد اليوم موزعة على 3 أطباء.",
      isRead: false,
    },
  ];
  for (const n of notifications) {
    await (prisma as any).notification.create({ data: n }).catch(() => null);
  }
  console.log("✅  إشعارات");

  // ══════════════════════════════════════════════════════════════════════════
  // 18. شكاوي + تقييمات + audit
  // ══════════════════════════════════════════════════════════════════════════
  const complaints = [
    {
      clinicId: clinicAlpha.id,
      submittedBy: drAlpha.id,
      category: ComplaintCategory.BUG,
      status: ComplaintStatus.RESOLVED,
      title: "خطأ في رفع الملفات",
      description: "لما بحاول أرفع ملف PDF بيجيلي خطأ 404.",
      adminReply: "تم حل المشكلة.",
      resolvedAt: daysAgo(5),
      createdAt: daysAgo(10),
    },
    {
      clinicId: clinicAlpha.id,
      submittedBy: drAlpha.id,
      category: ComplaintCategory.FEATURE,
      status: ComplaintStatus.IN_REVIEW,
      title: "طلب: تذكيرات واتساب",
      description: "عايز النظام يبعت للمريض رسالة واتساب قبل موعده.",
      adminReply: null,
      createdAt: daysAgo(7),
    },
    {
      clinicId: clinicBeta.id,
      submittedBy: drBeta.id,
      category: ComplaintCategory.BILLING,
      status: ComplaintStatus.RESOLVED,
      title: "الفاتورة مش بتتطبع صح",
      description: "لما بطبع الفاتورة بيطلع اسم المريض ناقص.",
      adminReply: "تم تحديث نظام الطباعة.",
      resolvedAt: daysAgo(3),
      createdAt: daysAgo(15),
    },
    {
      clinicId: clinicDelta.id,
      submittedBy: drDeltaAdmin.id,
      category: ComplaintCategory.FEATURE,
      status: ComplaintStatus.OPEN,
      title: "طلب: تقرير مقارنة الأطباء",
      description: "محتاج تقرير يقارن أداء الأطباء الثلاثة شهرياً.",
      adminReply: null,
      createdAt: daysAgo(2),
    },
  ];
  for (const c of complaints) {
    await (prisma as any).complaint.create({ data: c }).catch(() => null);
  }

  const ratings = [
    {
      clinicId: clinicAlpha.id,
      submittedBy: drAlpha.id,
      overall: 4,
      ease: 5,
      features: 4,
      support: 4,
      comment: "النظام ممتاز وسهل الاستخدام.",
      wouldRefer: true,
    },
    {
      clinicId: clinicBeta.id,
      submittedBy: drBeta.id,
      overall: 3,
      ease: 3,
      features: 3,
      support: 4,
      comment: "النظام كويس بس في حاجات كتير لسه محتاجة تتعمل.",
      wouldRefer: false,
    },
    {
      clinicId: clinicDelta.id,
      submittedBy: drDeltaAdmin.id,
      overall: 5,
      ease: 5,
      features: 5,
      support: 5,
      comment: "ممتاز جداً خصوصاً دعم أكتر من دكتور في نفس المركز!",
      wouldRefer: true,
    },
  ];
  for (const r of ratings) {
    await (prisma as any).siteRating.create({ data: r }).catch(() => null);
  }

  const auditActions = [
    {
      action: "CLINIC_ACTIVATED",
      entityType: "Clinic",
      entityId: clinicAlpha.id,
    },
    {
      action: "CLINIC_ACTIVATED",
      entityType: "Clinic",
      entityId: clinicDelta.id,
    },
    {
      action: "CLINIC_DEACTIVATED",
      entityType: "Clinic",
      entityId: clinicGamma.id,
    },
    {
      action: "DOCTOR_ADDED",
      entityType: "ClinicUser",
      entityId: drDeltaEye.id,
      meta: { role: "DOCTOR", specialty: "طب وجراحة العيون" },
    },
    {
      action: "DOCTOR_ADDED",
      entityType: "ClinicUser",
      entityId: drDeltaPeds.id,
      meta: { role: "DOCTOR", specialty: "طب الأطفال" },
    },
    {
      action: "SUBSCRIPTION_APPROVED",
      entityType: "SubscriptionRequest",
      meta: { plan: "YEARLY" },
    },
    {
      action: "SETTLEMENT_RECORDED",
      entityType: "DoctorSettlement",
      meta: {
        doctor: "د. هالة فريد النجار",
        month: prevMonthStr,
        amount: 8000,
      },
    },
    { action: "INVOICE_CREATED", entityType: "Invoice", meta: { amount: 450 } },
  ];
  for (const log of auditActions) {
    await (prisma as any).auditLog
      .create({
        data: {
          clinicId: clinicAlpha.id,
          actorId: drAlpha.id,
          createdAt: daysAgo(randInt(1, 30)),
          ...log,
        },
      })
      .catch(() => null);
  }
  console.log("✅  شكاوي + تقييمات + audit");

  // ══════════════════════════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n🎉  الـ Seed اتكمل بنجاح!\n");
  console.log("┌──────────────────────────────────────────────────────────┐");
  console.log("│                    بيانات الدخول                        │");
  console.log("├──────────────────────────────────────────────────────────┤");
  console.log("│ super@demo.test           ← Super Admin                  │");
  console.log("├──────────────────────────────────────────────────────────┤");
  console.log("│ [عيادة Alpha — دكتور واحد]                               │");
  console.log("│ dr.alpha@demo.test        ← DOCTOR_ADMIN (باطنة)         │");
  console.log("│ rec1.alpha@demo.test      ← RECEPTIONIST (نشطة)          │");
  console.log("│ rec2.alpha@demo.test      ← RECEPTIONIST (موقوفة)        │");
  console.log("├──────────────────────────────────────────────────────────┤");
  console.log("│ [عيادة Beta — اشتراك منتهي]                              │");
  console.log("│ dr.beta@demo.test         ← DOCTOR_ADMIN (أسنان)         │");
  console.log("│ rec.beta@demo.test        ← RECEPTIONIST                 │");
  console.log("├──────────────────────────────────────────────────────────┤");
  console.log("│ [عيادة Gamma — موقوفة]                                   │");
  console.log("│ dr.gamma@demo.test        ← DOCTOR_ADMIN (عيون)          │");
  console.log("├──────────────────────────────────────────────────────────┤");
  console.log("│ [مركز Delta — Multi-Doctor ← جديد]                       │");
  console.log("│ dr.delta.admin@demo.test  ← DOCTOR_ADMIN (باطنة, 30%)    │");
  console.log("│ dr.delta.eye@demo.test    ← DOCTOR (عيون, إيجار 8000)    │");
  console.log("│ dr.delta.peds@demo.test   ← DOCTOR (أطفال, 25%)          │");
  console.log("│ rec.delta@demo.test       ← RECEPTIONIST                 │");
  console.log("├──────────────────────────────────────────────────────────┤");
  console.log("│ كلمة السر لكل الحسابات: Password123!                     │");
  console.log("└──────────────────────────────────────────────────────────┘");
}

main()
  .catch((e) => {
    console.error("❌  خطأ في الـ seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
