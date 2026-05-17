/**
 * prisma/seed.ts — Full Clinic CMS Seed
 * ─────────────────────────────────────
 * يغطي كل سيناريوهات السيستم:
 *  1. Super-admin
 *  2. خطط الاشتراك
 *  3. 3 عيادات (نشطة، منتهية، موقوفة)
 *  4. دكاتره وسيكريترة (نشطين وغير نشطين)
 *  5. 60 مريض بحالات متنوعة
 *  6. 200+ موعد بكل الحالات
 *  7. روشتات وأدوية
 *  8. فواتير بطرق دفع مختلفة
 *  9. خطط تقسيط مع دفعات
 * 10. كتالوج خدمات وأدوية وأشعة
 * 11. رواتب موظفين
 * 12. طلبات اشتراك
 * 13. إشعارات
 * 14. شكاوي
 * 15. تقييمات المنصة
 * 16. Audit logs
 *
 * تشغيل: npx prisma db seed
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
  // 3. عيادة Alpha — نشطة، دكتور + سيكريتيرة × 2
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

  // ClinicUsers
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
  // Deactivated receptionist scenario
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

  // Subscription — active
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

  // Expired subscription
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
  // 5. عيادة Gamma — موقوفة (isActive: false)
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
  // 6. كتالوج الخدمات
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
      .create({
        data: { clinicId: clinicAlpha.id, ...s },
      })
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
    { name: "تقويم أسنان شفاف", price: 15000, category: "تقويم" },
    { name: "زراعة أسنان", price: 12000, category: "زراعة" },
  ];

  for (const s of servicesBeta) {
    await (prisma as any).serviceCatalog
      .create({
        data: { clinicId: clinicBeta.id, ...s },
      })
      .catch(() => null);
  }
  console.log("✅  كتالوج الخدمات");

  // ══════════════════════════════════════════════════════════════════════════
  // 7. كتالوج الأدوية
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
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 8. كتالوج الأشعة
  // ══════════════════════════════════════════════════════════════════════════
  const imaging = [
    { name: "أشعة سينية صدر", category: "X-Ray" },
    { name: "موجات صوتية بطن كامل", category: "Ultrasound" },
    { name: "موجات صوتية حوض", category: "Ultrasound" },
    { name: "CT صدر", category: "CT Scan" },
    { name: "CT بطن وحوض بتباين", category: "CT Scan" },
    { name: "MRI رأس", category: "MRI" },
    { name: "MRI عمود فقري", category: "MRI" },
    { name: "قلب صدى", category: "Echo" },
    { name: "رسم قلب ECG", category: "ECG" },
    { name: "فحص عيون قاع الشبكية", category: "Ophthalmology" },
  ];

  for (const img of imaging) {
    await (prisma as any).imagingCatalog
      .create({
        data: { clinicId: clinicAlpha.id, doctorId: drAlpha.id, ...img },
      })
      .catch(() => null);
  }
  console.log("✅  كتالوج الأدوية والأشعة");

  // ══════════════════════════════════════════════════════════════════════════
  // 9. 60 مريض لعيادة Alpha
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

  const phones = Array.from(
    { length: 60 },
    (_, i) => `+2010${String(i + 10000000).slice(1)}`,
  );

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
          phone: phones[i],
          dateOfBirth: new Date(birthYear, randInt(0, 11), randInt(1, 28)),
          medicalNotes:
            i % 5 === 0
              ? "حساسية من البنسلين"
              : i % 5 === 1
                ? "مريض سكري نوع 2 — متابعة منتظمة"
                : i % 5 === 2
                  ? "ضغط دم مرتفع"
                  : i % 7 === 0
                    ? "مريض قلب — يأخذ أسبرين"
                    : null,
        },
      }));
    patients.push(patient);
  }
  console.log(`✅  ${patients.length} مريض — عيادة Alpha`);

  // ══════════════════════════════════════════════════════════════════════════
  // 10. 20 مريض لعيادة Beta
  // ══════════════════════════════════════════════════════════════════════════
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
  console.log(`✅  ${betaPatients.length} مريض — عيادة Beta`);

  // ══════════════════════════════════════════════════════════════════════════
  // 11. مواعيد (Alpha) — 200+ موعد
  // ══════════════════════════════════════════════════════════════════════════
  const visitTypes = ["NEW_VISIT", "FOLLOW_UP", "EMERGENCY", "CONSULTATION"];
  const allAppts: any[] = [];

  // ─ مواعيد ماضية (90 يوم الماضية) — COMPLETED / CANCELLED
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

  // ─ مواعيد اليوم — IN_QUEUE / IN_PROGRESS / COMPLETED
  const todayStatuses: AppointmentStatus[] = [
    "COMPLETED",
    "COMPLETED",
    "IN_PROGRESS",
    "IN_QUEUE",
    "IN_QUEUE",
    "IN_QUEUE",
  ];
  for (let i = 0; i < 6; i++) {
    const patient = patients[i];
    const appt = await (prisma as any).appointment.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: patient.id,
        doctorId: drAlpha.id,
        startsAt: todayAt(9 + i * 1),
        endsAt: todayAt(10 + i * 1),
        status: todayStatuses[i],
        visitType: i < 2 ? "FOLLOW_UP" : "NEW_VISIT",
      },
    });
    allAppts.push(appt);
  }

  // ─ مواعيد مستقبلية (30 يوم قادمة)
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
  // 12. روشتات
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
      const meds = Array.from({ length: numMeds }, (_, i) => ({
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
  console.log(`✅  ${rxCount} روشتة`);

  // ══════════════════════════════════════════════════════════════════════════
  // 13. فواتير
  // ══════════════════════════════════════════════════════════════════════════
  const paymentMethods = ["CASH", "CARD", "INSURANCE", "TRANSFER"];
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
    const paidFull = Math.random() < 0.8;
    await (prisma as any).invoice
      .create({
        data: {
          clinicId: clinicAlpha.id,
          patientId: appt.patientId,
          appointmentId: appt.id,
          issuedById: rand([drAlpha.id, recAlpha1.id]),
          totalAmount: total,
          paidAmount: paidFull ? total : 0,
          paymentMethod: rand(paymentMethods),
          status: paidFull ? "PAID" : "PENDING",
          services,
          createdAt: appt.startsAt,
        },
      })
      .catch(() => null);
    invoiceCount++;
  }
  console.log(`✅  ${invoiceCount} فاتورة`);

  // ══════════════════════════════════════════════════════════════════════════
  // 14. خطط التقسيط (12 خطة بسيناريوهات مختلفة)
  // ══════════════════════════════════════════════════════════════════════════
  const installmentTitles = [
    "عملية ضرس العقل",
    "حشو عصب أمامي",
    "تقويم الفك",
    "زراعة ضرسين",
    "إجراء قلبي",
    "علاج كيماوي دعامة",
    "عملية استئصال الزائدة",
    "طرد حصوة كلى",
    "علاج ضغط مزمن",
    "متابعة سكر ربع سنوي",
    "تحاليل دورية",
    "ملف متكامل",
  ];

  for (let i = 0; i < 12; i++) {
    const patient = patients[i * 5];
    const total = randInt(1000, 15000);
    const paidSoFar = i < 4 ? 0 : i < 8 ? randInt(300, total - 100) : total;
    const status: InstallmentStatus =
      paidSoFar === 0 ? "PENDING" : paidSoFar >= total ? "PAID" : "PARTIAL";
    const completedAppt = completedAppts.find(
      (a) => a.patientId === patient.id,
    );

    const plan = await (prisma as any).installmentPlan.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: patient.id,
        appointmentId: completedAppt?.id ?? null,
        createdById: rand([drAlpha.id, recAlpha1.id]),
        title: installmentTitles[i],
        totalAmount: total,
        paidAmount: paidSoFar,
        status,
        notes: i % 3 === 0 ? "مريض ملتزم بالمواعيد" : null,
        createdAt: daysAgo(randInt(5, 60)),
      },
    });

    // Add individual payments
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
  console.log("✅  12 خطة تقسيط");

  // ══════════════════════════════════════════════════════════════════════════
  // 15. رواتب السيكريتيرة
  // ══════════════════════════════════════════════════════════════════════════
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
  console.log("✅  رواتب");

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
        screenshotUrl: "https://placehold.co/400x300?text=Transfer+Screenshot",
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
        screenshotUrl:
          "https://placehold.co/400x300?text=Transfer+Screenshot+2",
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
        rejectionReason: "الصورة غير واضحة — يرجى إعادة الإرسال",
      },
    })
    .catch(() => null);
  console.log("✅  طلبات اشتراك (3)");

  // ══════════════════════════════════════════════════════════════════════════
  // 17. إشعارات
  // ══════════════════════════════════════════════════════════════════════════
  const notifications = [
    {
      userId: drAlpha.id,
      type: "SUBSCRIPTION_APPROVED",
      title: "تم تجديد اشتراكك",
      body: "تم تجديد اشتراك عيادة ألفا لمدة سنة. اشتغل بكل راحة!",
      isRead: true,
    },
    {
      userId: drAlpha.id,
      type: "PATIENT_REMINDER",
      title: "تذكير: 6 مرضى اليوم",
      body: "عندك 6 مرضى محجوزين اليوم. ابدأ يومك!",
      isRead: false,
    },
    {
      userId: drAlpha.id,
      type: "INSTALLMENT_PAID",
      title: "دفعة تقسيط جديدة",
      body: "دفع المريض محمد أحمد عبدالله 500 جنيه من خطة تقسيطه.",
      isRead: false,
    },
    {
      userId: drBeta.id,
      type: "SUBSCRIPTION_EXPIRED",
      title: "انتهى اشتراكك",
      body: "انتهى اشتراك عيادة بيتا. جدد الآن لتستمر في استخدام النظام.",
      isRead: false,
    },
    {
      userId: drBeta.id,
      type: "SUBSCRIPTION_REJECTED",
      title: "تم رفض طلب الاشتراك",
      body: "تم رفض طلب تجديد الاشتراك: الصورة غير واضحة.",
      isRead: false,
    },
    {
      userId: drGamma.id,
      type: "CLINIC_DEACTIVATED",
      title: "تم إيقاف عيادتك",
      body: "تم إيقاف عيادة جاما مؤقتاً من قِبل الإدارة.",
      isRead: false,
    },
    {
      userId: recAlpha1.id,
      type: "APPOINTMENT_REMINDER",
      title: "مريض جديد في الطابور",
      body: "تم إضافة مريض جديد لطابور اليوم.",
      isRead: true,
    },
  ];

  for (const n of notifications) {
    await (prisma as any).notification.create({ data: n }).catch(() => null);
  }
  console.log("✅  إشعارات");

  // ══════════════════════════════════════════════════════════════════════════
  // 18. شكاوي
  // ══════════════════════════════════════════════════════════════════════════
  const complaints = [
    {
      clinicId: clinicAlpha.id,
      submittedBy: drAlpha.id,
      category: ComplaintCategory.BUG,
      status: ComplaintStatus.RESOLVED,
      title: "خطأ في رفع الملفات",
      description:
        "لما بحاول أرفع ملف PDF للمريض بيجيلي خطأ 404 ومش بيترفع. جربت أكتر من مرة.",
      adminReply:
        "تم حل المشكلة. كانت مشكلة في الـ Cloudinary config وتم تعديلها. جرب دلوقتي وأخبرنا.",
      resolvedAt: daysAgo(5),
      createdAt: daysAgo(10),
    },
    {
      clinicId: clinicAlpha.id,
      submittedBy: drAlpha.id,
      category: ComplaintCategory.FEATURE,
      status: ComplaintStatus.IN_REVIEW,
      title: "طلب: تذكيرات واتساب للمرضى",
      description:
        "عايز النظام يبعت للمريض رسالة واتساب قبل موعده بيوم تلقائياً. ده هيوفر وقت كتير على السيكريتيرة.",
      adminReply: null,
      createdAt: daysAgo(7),
    },
    {
      clinicId: clinicAlpha.id,
      submittedBy: drAlpha.id,
      category: ComplaintCategory.PERFORMANCE,
      status: ComplaintStatus.OPEN,
      title: "الموقع بطيء وقت الذروة",
      description:
        "لما بيكون عندي 3-4 نوافذ مفتوحة في نفس الوقت الموقع بيبطأ جداً خصوصاً صفحة المرضى.",
      adminReply: null,
      createdAt: daysAgo(2),
    },
    {
      clinicId: clinicBeta.id,
      submittedBy: drBeta.id,
      category: ComplaintCategory.BILLING,
      status: ComplaintStatus.RESOLVED,
      title: "الفاتورة مش بتتطبع صح",
      description:
        "لما بطبع الفاتورة بيطلع اسم المريض ناقص والتاريخ بيبقى غلط.",
      adminReply: "تم تحديث نظام الطباعة. جرب دلوقتي.",
      resolvedAt: daysAgo(3),
      createdAt: daysAgo(15),
    },
    {
      clinicId: clinicBeta.id,
      submittedBy: drBeta.id,
      category: ComplaintCategory.UX,
      status: ComplaintStatus.OPEN,
      title: "صعوبة في تصفح ملف المريض",
      description:
        "لما بدور على روشتة قديمة بتاع مريض لازم أسكرول كتير. محتاج فلتر أو بحث جوه الملف.",
      adminReply: null,
      createdAt: daysAgo(1),
    },
  ];

  for (const c of complaints) {
    await (prisma as any).complaint.create({ data: c }).catch(() => null);
  }
  console.log("✅  شكاوي (5)");

  // ══════════════════════════════════════════════════════════════════════════
  // 19. تقييمات المنصة
  // ══════════════════════════════════════════════════════════════════════════
  const ratings = [
    {
      clinicId: clinicAlpha.id,
      submittedBy: drAlpha.id,
      overall: 4,
      ease: 5,
      features: 4,
      support: 4,
      comment:
        "النظام ممتاز وسهل الاستخدام. بس محتاجين تضيفوا واتساب API وتقارير أكثر تفصيلاً.",
      wouldRefer: true,
    },
    {
      clinicId: clinicBeta.id,
      submittedBy: drBeta.id,
      overall: 3,
      ease: 3,
      features: 3,
      support: 4,
      comment:
        "النظام كويس بس في حاجات كتير لسه محتاجة تتعمل. أتمنى يتحسن مع الوقت.",
      wouldRefer: false,
    },
  ];

  for (const r of ratings) {
    await (prisma as any).siteRating.create({ data: r }).catch(() => null);
  }
  console.log("✅  تقييمات المنصة (2)");

  // ══════════════════════════════════════════════════════════════════════════
  // 20. Audit Logs
  // ══════════════════════════════════════════════════════════════════════════
  const auditActions = [
    {
      action: "CLINIC_ACTIVATED",
      entityType: "Clinic",
      entityId: clinicAlpha.id,
    },
    {
      action: "CLINIC_DEACTIVATED",
      entityType: "Clinic",
      entityId: clinicGamma.id,
    },
    {
      action: "CLINIC_STAFF_DEACTIVATED",
      entityType: "User",
      entityId: recAlpha2.id,
      meta: { role: "RECEPTIONIST" },
    },
    {
      action: "SUBSCRIPTION_APPROVED",
      entityType: "SubscriptionRequest",
      meta: { plan: "YEARLY" },
    },
    {
      action: "SUBSCRIPTION_REJECTED",
      entityType: "SubscriptionRequest",
      meta: { reason: "صورة غير واضحة" },
    },
    {
      action: "PATIENT_CREATED",
      entityType: "Patient",
      meta: { code: "P0001" },
    },
    {
      action: "PRESCRIPTION_ISSUED",
      entityType: "Prescription",
      meta: { diagnosis: "ارتفاع ضغط الدم" },
    },
    { action: "INVOICE_CREATED", entityType: "Invoice", meta: { amount: 450 } },
    {
      action: "INSTALLMENT_PAYMENT_ADDED",
      entityType: "InstallmentPlan",
      meta: { amount: 500 },
    },
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
  console.log("✅  Audit logs");

  // ══════════════════════════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n🎉  الـ Seed اتكمل بنجاح!\n");
  console.log("┌─────────────────────────────────────────────┐");
  console.log("│              بيانات الدخول                  │");
  console.log("├─────────────────────────────────────────────┤");
  console.log("│ super@demo.test          ← Super Admin       │");
  console.log("│ dr.alpha@demo.test       ← دكتور ألفا        │");
  console.log("│ rec1.alpha@demo.test     ← سيكريتيرة ألفا    │");
  console.log("│ rec2.alpha@demo.test     ← سيكريتيرة (موقوف) │");
  console.log("│ dr.beta@demo.test        ← دكتور بيتا         │");
  console.log("│ rec.beta@demo.test       ← سيكريتيرة بيتا    │");
  console.log("│ dr.gamma@demo.test       ← دكتور عيادة موقوفة│");
  console.log("├─────────────────────────────────────────────┤");
  console.log("│ كلمة السر لكل الحسابات: Password123!        │");
  console.log("└─────────────────────────────────────────────┘");
}

main()
  .catch((e) => {
    console.error("❌  خطأ في الـ seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
