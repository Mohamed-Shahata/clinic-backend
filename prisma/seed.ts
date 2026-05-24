/**
 * prisma/seed.ts
 * ─────────────
 * عيادتان:
 *  - عيادة النور   : دكتور واحد (DOCTOR_ADMIN) + سيكريتيرة واحدة
 *  - مركز الشفاء   : دكتور مدير (DOCTOR_ADMIN) + دكتورين (DOCTOR) + سيكريتيرتين
 *
 * تشغيل : npx prisma db seed
 * reset  : npx prisma migrate reset   ← يشغّل الـ seed تلقائياً
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

// ── helpers ──────────────────────────────────────────────────────────────────
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setSeconds(0, 0);
  return d;
};
const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setSeconds(0, 0);
  return d;
};
const todayAt = (h: number, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};
const pastAt = (daysBack: number, h: number) => {
  const d = daysAgo(daysBack);
  d.setHours(h, 0, 0, 0);
  return d;
};
const futureAt = (daysAhead: number, h: number) => {
  const d = daysFromNow(daysAhead);
  d.setHours(h, 0, 0, 0);
  return d;
};
const pc = (n: number) => `P${String(n).padStart(4, "0")}`;
const rand = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const visitTypes = ["NEW_VISIT", "FOLLOW_UP", "EMERGENCY", "CONSULTATION"];
const diagnosisList = [
  "ارتفاع ضغط الدم",
  "سكري نوع 2",
  "خمول الغدة الدرقية",
  "التهاب المعدة",
  "ارتفاع الكوليسترول",
  "فقر الدم",
  "التهاب الجهاز التنفسي",
  "نقص فيتامين د",
  "حمى",
  "التهاب اللوزتين",
];
const payMethods = ["cash", "vodafone_cash", "transfer", "insurance"];

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
  "مصطفى رمضان",
  "عبدالرحمن سامي",
  "هاني وائل صالح",
  "مروان فتحي رضوان",
  "وائل سمير العيسى",
  "رامي جمال يحيى",
  "سامي حمدي ثابت",
  "أيمن عبدالحميد",
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
  "حنين عبدالرحمن",
  "غادة محمد رجب",
];

// ── main ─────────────────────────────────────────────────────────────────────
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
  // 3. عيادة النور — دكتور واحد + سيكريتيرة
  // ══════════════════════════════════════════════════════════════════════════
  const clinicNoor = await (prisma as any).clinic.upsert({
    where: { slug: "noor-clinic" },
    update: { isActive: true },
    create: {
      slug: "noor-clinic",
      name: "عيادة النور للباطنة",
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

  const drNoor = await prisma.user.upsert({
    where: { email: "dr.noor@demo.test" },
    update: {},
    create: {
      email: "dr.noor@demo.test",
      phone: "+201001111111",
      fullName: "د. أحمد محمود السيد",
      passwordHash: await ph(),
    },
  });
  const recNoor = await prisma.user.upsert({
    where: { email: "rec.noor@demo.test" },
    update: {},
    create: {
      email: "rec.noor@demo.test",
      phone: "+201002222222",
      fullName: "سارة إبراهيم عبدالله",
      passwordHash: await ph(),
    },
  });

  const cuDrNoor = await (prisma as any).clinicUser.upsert({
    where: { clinicId_userId: { clinicId: clinicNoor.id, userId: drNoor.id } },
    update: {},
    create: {
      clinicId: clinicNoor.id,
      userId: drNoor.id,
      role: ClinicRole.DOCTOR_ADMIN,
      specialty: "الباطنة والغدد الصماء",
      consultationFee: 300,
      followUpFee: 150,
      subscriptionPeriod: "YEARLY",
      isActive: true,
    },
  });
  const cuRecNoor = await (prisma as any).clinicUser.upsert({
    where: { clinicId_userId: { clinicId: clinicNoor.id, userId: recNoor.id } },
    update: {},
    create: {
      clinicId: clinicNoor.id,
      userId: recNoor.id,
      role: ClinicRole.RECEPTIONIST,
      isActive: true,
    },
  });

  await (prisma as any).clinicSubscription.upsert({
    where: { clinicId: clinicNoor.id },
    update: {},
    create: {
      clinicId: clinicNoor.id,
      planId: planYearly.id,
      startsAt: daysAgo(60),
      expiresAt: daysFromNow(305),
      status: "ACTIVE",
    },
  });
  console.log(`✅  عيادة النور → ${drNoor.email} + ${recNoor.email}`);

  // خدمات عيادة النور
  const noorServices = [
    { name: "كشف باطنة", price: 300, category: "كشف" },
    { name: "كشف متابعة", price: 150, category: "كشف" },
    { name: "تحليل سكر صائم", price: 80, category: "تحاليل" },
    { name: "تحليل وظائف كبد", price: 120, category: "تحاليل" },
    { name: "صورة دم كاملة", price: 60, category: "تحاليل" },
    { name: "أشعة سينية صدر", price: 150, category: "أشعة" },
    { name: "موجات صوتية بطن", price: 250, category: "أشعة" },
    { name: "رسم قلب", price: 100, category: "إجراء" },
    { name: "قياس ضغط 24 ساعة", price: 400, category: "إجراء" },
  ];
  for (const s of noorServices) {
    await (prisma as any).serviceCatalog
      .create({ data: { clinicId: clinicNoor.id, ...s } })
      .catch(() => null);
  }

  // أدوية وأشعة — عيادة النور
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
  ];
  for (const m of medications) {
    await (prisma as any).medicationCatalog
      .create({ data: { clinicId: clinicNoor.id, doctorId: drNoor.id, ...m } })
      .catch(() => null);
  }
  const imagingList = [
    { name: "أشعة سينية صدر", category: "X-Ray" },
    { name: "موجات صوتية بطن كامل", category: "Ultrasound" },
    { name: "CT بطن وحوض بتباين", category: "CT Scan" },
    { name: "MRI رأس", category: "MRI" },
    { name: "قلب صدى", category: "Echo" },
    { name: "رسم قلب ECG", category: "ECG" },
  ];
  for (const img of imagingList) {
    await (prisma as any).imagingCatalog
      .create({
        data: { clinicId: clinicNoor.id, doctorId: drNoor.id, ...img },
      })
      .catch(() => null);
  }

  // ── مرضى عيادة النور (30 مريض)
  const noorPatients: any[] = [];
  for (let i = 0; i < 30; i++) {
    const existing = await (prisma as any).patient.findUnique({
      where: { clinicId_code: { clinicId: clinicNoor.id, code: pc(i + 1) } },
    });
    const p =
      existing ??
      (await (prisma as any).patient.create({
        data: {
          clinicId: clinicNoor.id,
          createdById: drNoor.id,
          code: pc(i + 1),
          fullName: arabicNames[i] ?? `مريض ${i + 1}`,
          phone: `+2010${String(i + 10000000).slice(1)}`,
          dateOfBirth: new Date(
            randInt(1960, 2005),
            randInt(0, 11),
            randInt(1, 28),
          ),
          medicalNotes:
            i % 5 === 0
              ? "حساسية من البنسلين"
              : i % 5 === 1
                ? "مريض سكري نوع 2"
                : i % 5 === 2
                  ? "ضغط دم مرتفع"
                  : null,
        },
      }));
    noorPatients.push(p);
  }
  console.log(`✅  ${noorPatients.length} مريض — عيادة النور`);

  // ── مواعيد عيادة النور
  const noorAppts: any[] = [];

  // ماضية (45 يوم)
  for (let day = 1; day <= 45; day++) {
    for (let j = 0; j < randInt(2, 5); j++) {
      const patient = rand(noorPatients);
      const h = randInt(9, 16);
      const status = Math.random() < 0.85 ? "COMPLETED" : "CANCELLED";
      const a = await (prisma as any).appointment.create({
        data: {
          clinicId: clinicNoor.id,
          patientId: patient.id,
          doctorId: drNoor.id,
          startsAt: pastAt(day, h),
          endsAt: pastAt(day, h + 1),
          status,
          visitType: rand(visitTypes),
          notes: j % 3 === 0 ? "متابعة مزمنة" : null,
        },
      });
      noorAppts.push(a);
    }
  }

  // اليوم
  const todayStatusesNoor: AppointmentStatus[] = [
    "COMPLETED",
    "COMPLETED",
    "IN_PROGRESS",
    "IN_QUEUE",
    "IN_QUEUE",
  ];
  for (let i = 0; i < 5; i++) {
    const a = await (prisma as any).appointment.create({
      data: {
        clinicId: clinicNoor.id,
        patientId: noorPatients[i]!.id,
        doctorId: drNoor.id,
        startsAt: todayAt(9 + i),
        endsAt: todayAt(10 + i),
        status: todayStatusesNoor[i],
        visitType: i < 2 ? "FOLLOW_UP" : "NEW_VISIT",
      },
    });
    noorAppts.push(a);
  }

  // مستقبلية (10 أيام)
  for (let day = 1; day <= 10; day++) {
    for (let j = 0; j < randInt(1, 3); j++) {
      const a = await (prisma as any).appointment.create({
        data: {
          clinicId: clinicNoor.id,
          patientId: rand(noorPatients).id,
          doctorId: drNoor.id,
          startsAt: futureAt(day, randInt(9, 15)),
          endsAt: futureAt(day, randInt(10, 16)),
          status: "IN_QUEUE",
          visitType: rand(visitTypes),
        },
      });
      noorAppts.push(a);
    }
  }

  const noorCompleted = noorAppts.filter((a) => a.status === "COMPLETED");
  console.log(
    `✅  ${noorAppts.length} موعد (${noorCompleted.length} مكتمل) — النور`,
  );

  // ── روشتات
  let rxCount = 0;
  for (const appt of noorCompleted.slice(0, 60)) {
    if (Math.random() < 0.7) {
      const meds = Array.from({ length: randInt(1, 3) }, () => ({
        name: rand(medications).name,
        dose: rand(["500mg", "20mg", "10mg", "5mg"]),
        frequency: rand(["مرة يومياً", "مرتين يومياً", "3 مرات يومياً"]),
        duration: rand(["7 أيام", "أسبوعان", "شهر", "مستمر"]),
      }));
      await (prisma as any).prescription
        .create({
          data: {
            clinicId: clinicNoor.id,
            patientId: appt.patientId,
            doctorId: drNoor.id,
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
  console.log(`✅  ${rxCount} روشتة — النور`);

  // ── فواتير
  let invCount = 0;
  for (const appt of noorCompleted.slice(0, 55)) {
    const isFollowUp = appt.visitType === "FOLLOW_UP";
    const fee = isFollowUp ? 150 : 300;
    const extra = Math.random() < 0.35;
    const total = fee + (extra ? randInt(60, 250) : 0);
    await (prisma as any).invoice
      .create({
        data: {
          clinicId: clinicNoor.id,
          patientId: appt.patientId,
          appointmentId: appt.id,
          issuedById: rand([drNoor.id, recNoor.id]),
          totalAmount: total,
          paidAmount: Math.random() < 0.82 ? total : 0,
          paymentMethod: rand(payMethods),
          status: Math.random() < 0.82 ? "PAID" : "PENDING",
          services: [
            {
              name: isFollowUp ? "كشف متابعة" : "كشف باطنة",
              price: fee,
              qty: 1,
            },
            ...(extra
              ? [
                  {
                    name: rand(["تحليل سكر", "موجات صوتية", "رسم قلب"]),
                    price: total - fee,
                    qty: 1,
                  },
                ]
              : []),
          ],
          createdAt: appt.startsAt,
        },
      })
      .catch(() => null);
    invCount++;
  }
  console.log(`✅  ${invCount} فاتورة — النور`);

  // ── تقسيط
  for (let i = 0; i < 6; i++) {
    const patient = noorPatients[i * 5]!;
    const total = randInt(1000, 10000);
    const paid = i < 2 ? 0 : i < 4 ? randInt(300, total - 100) : total;
    const status: InstallmentStatus =
      paid === 0 ? "PENDING" : paid >= total ? "PAID" : "PARTIAL";
    const plan = await (prisma as any).installmentPlan.create({
      data: {
        clinicId: clinicNoor.id,
        patientId: patient.id,
        createdById: recNoor.id,
        title: rand(["خطة علاج مزمن", "متابعة طويلة", "ملف متكامل"]),
        totalAmount: total,
        paidAmount: paid,
        status,
        createdAt: daysAgo(randInt(5, 40)),
      },
    });
    if (paid > 0) {
      await (prisma as any).installmentPayment
        .create({
          data: {
            planId: plan.id,
            amount: paid,
            note: "دفعة",
            paidAt: daysAgo(randInt(1, 30)),
            recordedBy: recNoor.id,
          },
        })
        .catch(() => null);
    }
  }

  // ── راتب السيكريتيرة
  const salary = await (prisma as any).staffSalary
    .create({
      data: {
        clinicId: clinicNoor.id,
        clinicUserId: cuRecNoor.id,
        monthlyAmount: 3500,
        effectiveFrom: daysAgo(180),
        isActive: true,
      },
    })
    .catch(() => null);
  if (salary) {
    for (let m = 1; m <= 4; m++) {
      await (prisma as any).salaryPayment
        .create({
          data: {
            salaryId: salary.id,
            clinicId: clinicNoor.id,
            amount: 3500,
            paidAt: daysAgo(m * 30),
            note: `راتب شهر ${m}`,
            paidById: drNoor.id,
          },
        })
        .catch(() => null);
    }
  }
  console.log("✅  تقسيط + رواتب — النور");

  // ══════════════════════════════════════════════════════════════════════════
  // 4. مركز الشفاء — Multi-Doctor
  // ══════════════════════════════════════════════════════════════════════════
  const clinicShifa = await (prisma as any).clinic.upsert({
    where: { slug: "shifa-center" },
    update: { isActive: true },
    create: {
      slug: "shifa-center",
      name: "مركز الشفاء الطبي",
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

  // الأطباء
  const drShifaAdmin = await prisma.user.upsert({
    where: { email: "dr.shifa.admin@demo.test" },
    update: {},
    create: {
      email: "dr.shifa.admin@demo.test",
      phone: "+201003333333",
      fullName: "د. كريم سامي العربي",
      passwordHash: await ph(),
    },
  });
  const drShifaEye = await prisma.user.upsert({
    where: { email: "dr.shifa.eye@demo.test" },
    update: {},
    create: {
      email: "dr.shifa.eye@demo.test",
      phone: "+201004444444",
      fullName: "د. هالة فريد النجار",
      passwordHash: await ph(),
    },
  });
  const drShifaPeds = await prisma.user.upsert({
    where: { email: "dr.shifa.peds@demo.test" },
    update: {},
    create: {
      email: "dr.shifa.peds@demo.test",
      phone: "+201005555555",
      fullName: "د. سامر رضا الغزالي",
      passwordHash: await ph(),
    },
  });

  // السيكريتيرات
  const recShifa1 = await prisma.user.upsert({
    where: { email: "rec1.shifa@demo.test" },
    update: {},
    create: {
      email: "rec1.shifa@demo.test",
      phone: "+201006666666",
      fullName: "إيمان وليد سليمان",
      passwordHash: await ph(),
    },
  });
  const recShifa2 = await prisma.user.upsert({
    where: { email: "rec2.shifa@demo.test" },
    update: {},
    create: {
      email: "rec2.shifa@demo.test",
      phone: "+201007777777",
      fullName: "رانيا مصطفى جابر",
      passwordHash: await ph(),
    },
  });

  // ClinicUsers
  await (prisma as any).clinicUser.upsert({
    where: {
      clinicId_userId: { clinicId: clinicShifa.id, userId: drShifaAdmin.id },
    },
    update: {},
    create: {
      clinicId: clinicShifa.id,
      userId: drShifaAdmin.id,
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
      clinicId_userId: { clinicId: clinicShifa.id, userId: drShifaEye.id },
    },
    update: {},
    create: {
      clinicId: clinicShifa.id,
      userId: drShifaEye.id,
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
      clinicId_userId: { clinicId: clinicShifa.id, userId: drShifaPeds.id },
    },
    update: {},
    create: {
      clinicId: clinicShifa.id,
      userId: drShifaPeds.id,
      role: ClinicRole.DOCTOR,
      specialty: "طب الأطفال",
      consultationFee: 300,
      followUpFee: 150,
      paymentMode: "PERCENTAGE",
      adminPercentage: 25,
      isActive: true,
    },
  });
  const cuRecShifa1 = await (prisma as any).clinicUser.upsert({
    where: {
      clinicId_userId: { clinicId: clinicShifa.id, userId: recShifa1.id },
    },
    update: {},
    create: {
      clinicId: clinicShifa.id,
      userId: recShifa1.id,
      role: ClinicRole.RECEPTIONIST,
      isActive: true,
    },
  });
  await (prisma as any).clinicUser.upsert({
    where: {
      clinicId_userId: { clinicId: clinicShifa.id, userId: recShifa2.id },
    },
    update: {},
    create: {
      clinicId: clinicShifa.id,
      userId: recShifa2.id,
      role: ClinicRole.RECEPTIONIST,
      isActive: true,
    },
  });

  await (prisma as any).clinicSubscription.upsert({
    where: { clinicId: clinicShifa.id },
    update: {},
    create: {
      clinicId: clinicShifa.id,
      planId: planSixMonths.id,
      startsAt: daysAgo(30),
      expiresAt: daysFromNow(150),
      status: "ACTIVE",
    },
  });
  console.log(
    `✅  مركز الشفاء → ${drShifaAdmin.email} + ${drShifaEye.email} + ${drShifaPeds.email}`,
  );

  // خدمات مركز الشفاء
  const shifaServices = [
    { name: "كشف باطنة", price: 400, category: "كشف" },
    { name: "كشف عيون", price: 350, category: "كشف" },
    { name: "كشف أطفال", price: 300, category: "كشف" },
    { name: "قياس النظر", price: 100, category: "عيون" },
    { name: "فحص قاع العين", price: 200, category: "عيون" },
    { name: "تطعيمات أطفال", price: 150, category: "أطفال" },
    { name: "متابعة نمو", price: 200, category: "أطفال" },
    { name: "موجات صوتية", price: 250, category: "أشعة" },
  ];
  for (const s of shifaServices) {
    await (prisma as any).serviceCatalog
      .create({ data: { clinicId: clinicShifa.id, ...s } })
      .catch(() => null);
  }
  for (const m of medications) {
    await (prisma as any).medicationCatalog
      .create({
        data: { clinicId: clinicShifa.id, doctorId: drShifaAdmin.id, ...m },
      })
      .catch(() => null);
  }
  for (const img of imagingList) {
    await (prisma as any).imagingCatalog
      .create({
        data: { clinicId: clinicShifa.id, doctorId: drShifaAdmin.id, ...img },
      })
      .catch(() => null);
  }

  // ── مرضى مركز الشفاء (20 مريض)
  const shifaPatients: any[] = [];
  for (let i = 0; i < 20; i++) {
    const existing = await (prisma as any).patient.findUnique({
      where: { clinicId_code: { clinicId: clinicShifa.id, code: pc(i + 1) } },
    });
    const p =
      existing ??
      (await (prisma as any).patient.create({
        data: {
          clinicId: clinicShifa.id,
          createdById: recShifa1.id,
          code: pc(i + 1),
          fullName: arabicNames[i + 30] ?? `مريض ${i + 1}`,
          phone: `+2011${String(i + 10000000).slice(1)}`,
          dateOfBirth: new Date(
            randInt(1965, 2020),
            randInt(0, 11),
            randInt(1, 28),
          ),
          medicalNotes: i % 4 === 0 ? "حساسية من البنسلين" : null,
        },
      }));
    shifaPatients.push(p);
  }
  console.log(`✅  ${shifaPatients.length} مريض — مركز الشفاء`);

  // ── مواعيد مركز الشفاء (لكل دكتور)
  const shifaDoctors = [
    { id: drShifaAdmin.id, fee: 400, followFee: 200 },
    { id: drShifaEye.id, fee: 350, followFee: 150 },
    { id: drShifaPeds.id, fee: 300, followFee: 150 },
  ];
  const shifaAppts: any[] = [];

  for (let day = 1; day <= 30; day++) {
    for (const doc of shifaDoctors) {
      for (let j = 0; j < randInt(1, 4); j++) {
        const h = randInt(8, 18);
        const status = Math.random() < 0.82 ? "COMPLETED" : "CANCELLED";
        const a = await (prisma as any).appointment.create({
          data: {
            clinicId: clinicShifa.id,
            patientId: rand(shifaPatients).id,
            doctorId: doc.id,
            startsAt: pastAt(day, h),
            endsAt: pastAt(day, h + 1),
            status,
            visitType: rand(visitTypes),
          },
        });
        shifaAppts.push({ ...a, fee: doc.fee, followFee: doc.followFee });
      }
    }
  }

  // اليوم — 3 مواعيد لكل دكتور
  const todayShifaStatuses: AppointmentStatus[] = [
    "COMPLETED",
    "IN_PROGRESS",
    "IN_QUEUE",
  ];
  for (const [di, doc] of shifaDoctors.entries()) {
    for (let i = 0; i < 3; i++) {
      const a = await (prisma as any).appointment.create({
        data: {
          clinicId: clinicShifa.id,
          patientId: shifaPatients[(di * 3 + i) % shifaPatients.length]!.id,
          doctorId: doc.id,
          startsAt: todayAt(9 + i * 2),
          endsAt: todayAt(10 + i * 2),
          status: todayShifaStatuses[i],
          visitType: i === 0 ? "FOLLOW_UP" : "NEW_VISIT",
        },
      });
      shifaAppts.push({ ...a, fee: doc.fee, followFee: doc.followFee });
    }
  }

  // مستقبلية
  for (let day = 1; day <= 7; day++) {
    for (const doc of shifaDoctors) {
      for (let j = 0; j < randInt(1, 2); j++) {
        const a = await (prisma as any).appointment.create({
          data: {
            clinicId: clinicShifa.id,
            patientId: rand(shifaPatients).id,
            doctorId: doc.id,
            startsAt: futureAt(day, randInt(9, 16)),
            endsAt: futureAt(day, randInt(10, 17)),
            status: "IN_QUEUE",
            visitType: rand(visitTypes),
          },
        });
        shifaAppts.push({ ...a, fee: doc.fee, followFee: doc.followFee });
      }
    }
  }

  const shifaCompleted = shifaAppts.filter((a) => a.status === "COMPLETED");
  console.log(
    `✅  ${shifaAppts.length} موعد (${shifaCompleted.length} مكتمل) — الشفاء`,
  );

  // ── فواتير مركز الشفاء
  let shifaInvCount = 0;
  for (const appt of shifaCompleted.slice(0, 60)) {
    const isFollowUp = appt.visitType === "FOLLOW_UP";
    const fee = isFollowUp ? (appt.followFee ?? 150) : (appt.fee ?? 300);
    await (prisma as any).invoice
      .create({
        data: {
          clinicId: clinicShifa.id,
          patientId: appt.patientId,
          appointmentId: appt.id,
          issuedById: rand([recShifa1.id, recShifa2.id]),
          totalAmount: fee,
          paidAmount: fee,
          paymentMethod: rand(payMethods),
          status: "PAID",
          services: [
            { name: isFollowUp ? "كشف متابعة" : "كشف", price: fee, qty: 1 },
          ],
          createdAt: appt.startsAt,
        },
      })
      .catch(() => null);
    shifaInvCount++;
  }
  console.log(`✅  ${shifaInvCount} فاتورة — الشفاء`);

  // ── تسويات الشهر الماضي (DoctorSettlement)
  const now = new Date();
  const prevM = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevY =
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const prevMonthStr = `${prevY}-${String(prevM).padStart(2, "0")}`;

  // د. هالة — إيجار ثابت 8000 — مدفوعة
  await prisma.$executeRaw`
    INSERT INTO "DoctorSettlement" (id,"clinicId","doctorUserId",month,"totalRevenue","clinicShare","doctorNet",status,"paidAmount","paymentMethod",notes,"paidAt","createdAt","updatedAt")
    VALUES (${`${clinicShifa.id}-${drShifaEye.id}-${prevMonthStr}`},${clinicShifa.id},${drShifaEye.id},${prevMonthStr},15000,8000,7000,'PAID',8000,'cash','تم الاستلام نقداً',${daysAgo(5)},${daysAgo(7)},${daysAgo(5)})
    ON CONFLICT ("clinicId","doctorUserId",month) DO NOTHING
  `;

  // د. سامر — 25% — جزئية
  await prisma.$executeRaw`
    INSERT INTO "DoctorSettlement" (id,"clinicId","doctorUserId",month,"totalRevenue","clinicShare","doctorNet",status,"paidAmount","paymentMethod",notes,"paidAt","createdAt","updatedAt")
    VALUES (${`${clinicShifa.id}-${drShifaPeds.id}-${prevMonthStr}`},${clinicShifa.id},${drShifaPeds.id},${prevMonthStr},9000,2250,6750,'PARTIAL',1000,'transfer','دفع جزء — الباقي الأسبوع القادم',${daysAgo(3)},${daysAgo(7)},${daysAgo(3)})
    ON CONFLICT ("clinicId","doctorUserId",month) DO NOTHING
  `;
  console.log("✅  DoctorSettlement — الشفاء");

  // ── رواتب السيكريتيرات — الشفاء
  const sal1 = await (prisma as any).staffSalary
    .create({
      data: {
        clinicId: clinicShifa.id,
        clinicUserId: cuRecShifa1.id,
        monthlyAmount: 4000,
        effectiveFrom: daysAgo(120),
        isActive: true,
      },
    })
    .catch(() => null);
  if (sal1) {
    for (let m = 1; m <= 3; m++) {
      await (prisma as any).salaryPayment
        .create({
          data: {
            salaryId: sal1.id,
            clinicId: clinicShifa.id,
            amount: 4000,
            paidAt: daysAgo(m * 30),
            note: `راتب شهر ${m}`,
            paidById: drShifaAdmin.id,
          },
        })
        .catch(() => null);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. طلبات اشتراك
  // ══════════════════════════════════════════════════════════════════════════
  await (prisma as any).subscriptionPaymentRequest
    .create({
      data: {
        clinicId: clinicNoor.id,
        planId: planYearly.id,
        requestedById: drNoor.id,
        transferPhone: "01098765432",
        screenshotUrl: "https://placehold.co/400x300?text=Noor+Payment",
        status: "APPROVED",
        reviewedById: superAdmin.id,
        reviewedAt: daysAgo(5),
      },
    })
    .catch(() => null);
  await (prisma as any).subscriptionPaymentRequest
    .create({
      data: {
        clinicId: clinicShifa.id,
        planId: planSixMonths.id,
        requestedById: drShifaAdmin.id,
        transferPhone: "01112223344",
        screenshotUrl: "https://placehold.co/400x300?text=Shifa+Payment",
        status: "PENDING",
      },
    })
    .catch(() => null);
  console.log("✅  طلبات اشتراك");

  // ══════════════════════════════════════════════════════════════════════════
  // 6. إشعارات
  // ══════════════════════════════════════════════════════════════════════════
  const notifications = [
    {
      userId: drNoor.id,
      type: "SUBSCRIPTION_APPROVED",
      title: "تم تجديد اشتراكك",
      body: "تم تجديد اشتراك عيادة النور لمدة سنة كاملة.",
      isRead: true,
    },
    {
      userId: drNoor.id,
      type: "PATIENT_REMINDER",
      title: "تذكير: 5 مرضى اليوم",
      body: "عندك 5 مرضى محجوزين اليوم.",
      isRead: false,
    },
    {
      userId: recNoor.id,
      type: "APPOINTMENT_REMINDER",
      title: "مريض جديد في الطابور",
      body: "تم إضافة مريض جديد.",
      isRead: true,
    },
    {
      userId: drShifaAdmin.id,
      type: "SUBSCRIPTION_PENDING",
      title: "طلب اشتراك قيد المراجعة",
      body: "طلب تجديد اشتراك مركز الشفاء قيد المراجعة.",
      isRead: false,
    },
    {
      userId: drShifaEye.id,
      type: "SETTLEMENT_RECORDED",
      title: "تم تسجيل التسوية",
      body: `تم تسجيل دفعة الإيجار شهر ${prevMonthStr}`,
      isRead: false,
    },
    {
      userId: drShifaPeds.id,
      type: "SETTLEMENT_PARTIAL",
      title: "تسوية جزئية مسجلة",
      body: "تم تسجيل دفعة 1000 جنيه. الباقي 1250 جنيه.",
      isRead: false,
    },
    {
      userId: recShifa1.id,
      type: "APPOINTMENT_REMINDER",
      title: "9 مواعيد اليوم",
      body: "9 مواعيد موزعة على 3 أطباء اليوم.",
      isRead: false,
    },
    {
      userId: recShifa2.id,
      type: "APPOINTMENT_REMINDER",
      title: "مواعيد تحتاج تأكيد",
      body: "يوجد 3 مواعيد غير مؤكدة.",
      isRead: false,
    },
  ];
  for (const n of notifications) {
    await (prisma as any).notification.create({ data: n }).catch(() => null);
  }
  console.log("✅  إشعارات");

  // ══════════════════════════════════════════════════════════════════════════
  // 7. شكاوي
  // ══════════════════════════════════════════════════════════════════════════
  const complaints = [
    {
      clinicId: clinicNoor.id,
      submittedBy: drNoor.id,
      category: ComplaintCategory.BUG,
      status: ComplaintStatus.RESOLVED,
      title: "خطأ في رفع الملفات",
      description: "لما بحاول أرفع PDF بيجيلي خطأ 404.",
      adminReply: "تم حل المشكلة.",
      resolvedAt: daysAgo(5),
      createdAt: daysAgo(12),
    },
    {
      clinicId: clinicNoor.id,
      submittedBy: drNoor.id,
      category: ComplaintCategory.FEATURE,
      status: ComplaintStatus.IN_REVIEW,
      title: "طلب: تذكيرات واتساب",
      description: "عايز النظام يبعت للمريض رسالة واتساب قبل موعده.",
      adminReply: null,
      createdAt: daysAgo(4),
    },
    {
      clinicId: clinicShifa.id,
      submittedBy: drShifaAdmin.id,
      category: ComplaintCategory.FEATURE,
      status: ComplaintStatus.OPEN,
      title: "تقرير مقارنة الأطباء",
      description: "محتاج تقرير شهري يقارن أداء الأطباء الثلاثة.",
      adminReply: null,
      createdAt: daysAgo(2),
    },
    {
      clinicId: clinicShifa.id,
      submittedBy: drShifaEye.id,
      category: ComplaintCategory.PERFORMANCE,
      status: ComplaintStatus.OPEN,
      title: "بطء في صفحة المرضى",
      description: "صفحة المرضى بتستغرق وقت طويل عند فتح 3 نوافذ.",
      adminReply: null,
      createdAt: daysAgo(1),
    },
  ];
  for (const c of complaints) {
    await (prisma as any).complaint.create({ data: c }).catch(() => null);
  }
  console.log("✅  شكاوي");

  // ══════════════════════════════════════════════════════════════════════════
  // 8. تقييمات المنصة
  // ══════════════════════════════════════════════════════════════════════════
  await (prisma as any).siteRating
    .create({
      data: {
        clinicId: clinicNoor.id,
        submittedBy: drNoor.id,
        overall: 4,
        ease: 5,
        features: 4,
        support: 4,
        comment: "النظام ممتاز وسهل الاستخدام. بس محتاجين واتساب API.",
        wouldRefer: true,
      },
    })
    .catch(() => null);
  await (prisma as any).siteRating
    .create({
      data: {
        clinicId: clinicShifa.id,
        submittedBy: drShifaAdmin.id,
        overall: 5,
        ease: 5,
        features: 5,
        support: 5,
        comment: "ممتاز خصوصاً دعم أكتر من دكتور في نفس المركز!",
        wouldRefer: true,
      },
    })
    .catch(() => null);
  console.log("✅  تقييمات");

  // ══════════════════════════════════════════════════════════════════════════
  // 9. Audit Logs
  // ══════════════════════════════════════════════════════════════════════════
  const auditLogs = [
    {
      clinicId: clinicNoor.id,
      actorId: drNoor.id,
      action: "CLINIC_ACTIVATED",
      entityType: "Clinic",
      meta: { name: "عيادة النور" },
    },
    {
      clinicId: clinicNoor.id,
      actorId: drNoor.id,
      action: "PATIENT_CREATED",
      entityType: "Patient",
      meta: { code: "P0001" },
    },
    {
      clinicId: clinicNoor.id,
      actorId: recNoor.id,
      action: "INVOICE_CREATED",
      entityType: "Invoice",
      meta: { amount: 300 },
    },
    {
      clinicId: clinicNoor.id,
      actorId: drNoor.id,
      action: "PRESCRIPTION_ISSUED",
      entityType: "Prescription",
      meta: { diagnosis: "سكري نوع 2" },
    },
    {
      clinicId: clinicShifa.id,
      actorId: drShifaAdmin.id,
      action: "CLINIC_ACTIVATED",
      entityType: "Clinic",
      meta: { name: "مركز الشفاء" },
    },
    {
      clinicId: clinicShifa.id,
      actorId: drShifaAdmin.id,
      action: "DOCTOR_ADDED",
      entityType: "ClinicUser",
      meta: { role: "DOCTOR", name: "د. هالة فريد النجار" },
    },
    {
      clinicId: clinicShifa.id,
      actorId: drShifaAdmin.id,
      action: "DOCTOR_ADDED",
      entityType: "ClinicUser",
      meta: { role: "DOCTOR", name: "د. سامر رضا الغزالي" },
    },
    {
      clinicId: clinicShifa.id,
      actorId: drShifaAdmin.id,
      action: "SETTLEMENT_RECORDED",
      entityType: "DoctorSettlement",
      meta: { doctor: "د. هالة", amount: 8000, month: prevMonthStr },
    },
    {
      clinicId: clinicShifa.id,
      actorId: recShifa1.id,
      action: "INVOICE_CREATED",
      entityType: "Invoice",
      meta: { amount: 400 },
    },
    {
      clinicId: clinicShifa.id,
      actorId: recShifa2.id,
      action: "APPOINTMENT_BOOKED",
      entityType: "Appointment",
      meta: { visitType: "NEW_VISIT" },
    },
  ];
  for (const log of auditLogs) {
    await (prisma as any).auditLog
      .create({ data: { ...log, createdAt: daysAgo(randInt(1, 20)) } })
      .catch(() => null);
  }
  console.log("✅  Audit Logs");

  // ══════════════════════════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n🎉  الـ Seed اتكمل بنجاح!\n");
  console.log(
    "┌──────────────────────────────────────────────────────────────┐",
  );
  console.log(
    "│                       بيانات الدخول                         │",
  );
  console.log(
    "├──────────────────────────────────────────────────────────────┤",
  );
  console.log(
    "│ super@demo.test             ← Super Admin                    │",
  );
  console.log(
    "├──────────────────────────────────────────────────────────────┤",
  );
  console.log(
    "│ 🏥 عيادة النور — دكتور واحد + سيكريتيرة                     │",
  );
  console.log(
    "│ dr.noor@demo.test           ← DOCTOR_ADMIN (باطنة)           │",
  );
  console.log(
    "│ rec.noor@demo.test          ← RECEPTIONIST                   │",
  );
  console.log(
    "├──────────────────────────────────────────────────────────────┤",
  );
  console.log(
    "│ 🏢 مركز الشفاء — Multi-Doctor                                │",
  );
  console.log(
    "│ dr.shifa.admin@demo.test    ← DOCTOR_ADMIN (باطنة, 30%)      │",
  );
  console.log(
    "│ dr.shifa.eye@demo.test      ← DOCTOR (عيون, إيجار 8000)      │",
  );
  console.log(
    "│ dr.shifa.peds@demo.test     ← DOCTOR (أطفال, 25%)            │",
  );
  console.log(
    "│ rec1.shifa@demo.test        ← RECEPTIONIST                   │",
  );
  console.log(
    "│ rec2.shifa@demo.test        ← RECEPTIONIST                   │",
  );
  console.log(
    "├──────────────────────────────────────────────────────────────┤",
  );
  console.log(
    "│ كلمة السر الموحدة: Password123!                              │",
  );
  console.log(
    "└──────────────────────────────────────────────────────────────┘",
  );
}

main()
  .catch((e) => {
    console.error("❌  خطأ:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
