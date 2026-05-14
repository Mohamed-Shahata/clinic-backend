/**
 * prisma/seed.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * شامل seed يغطي كل سيناريوهات النظام:
 *
 *  1. Super-admin (platform owner)
 *  2. خطط الاشتراك (monthly / 6-months / yearly)
 *  3. عيادتين منفصلتين بإعدادات مختلفة
 *     ├── عيادة Alpha  ← اشتراك نشط، دفع نسبة مئوية، مع receptionist
 *     └── عيادة Beta   ← اشتراك منتهي، دفع إيجار ثابت، بدون receptionist
 *  4. مرضى بحالات متنوعة (ملاحظات طبية / بدون / تاريخ ميلاد / ملفات)
 *  5. مواعيد بكل الحالات الممكنة
 *     (IN_QUEUE / IN_PROGRESS / COMPLETED / CANCELLED)
 *  6. روشتات بدوا / بدون أدوية وتحاليل وأشعة
 *  7. فواتير بطرق دفع مختلفة (cash / card / insurance)
 *  8. طلبات اشتراك (pending / approved / rejected)
 *  9. كتالوج أدوية وأشعة مخصصة لكل دكتور
 * 10. قوالب روشتات
 * 11. إشعارات (مقروءة / غير مقروءة)
 * 12. Audit logs لكل الأحداث
 * ─────────────────────────────────────────────────────────────────────────────
 * تشغيل: npx prisma db seed
 * كلمة السر الموحدة: Password123!
 */

import "dotenv/config";
import { PrismaClient, AppointmentStatus, ClinicRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "Password123!";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const pwd = () => hash(PASSWORD, 10);

/** يبني تاريخ نسبي من اليوم */
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setSeconds(0, 0);
  return d;
}

/** وقت محدد اليوم */
function todayAt(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** كود مريض تسلسلي */
function patientCode(n: number) {
  return `P${String(n).padStart(4, "0")}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  بدء الـ seed …\n");

  // ══════════════════════════════════════════════════════════════════════════
  // 1. Super-Admin
  // ══════════════════════════════════════════════════════════════════════════
  const superAdmin = await prisma.user.upsert({
    where: { email: "super@demo.test" },
    update: { fullName: "Platform Super Admin", isSuperAdmin: true },
    create: {
      email: "super@demo.test",
      fullName: "Platform Super Admin",
      passwordHash: await pwd(),
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
    create: {
      code: "MONTHLY",
      name: "شهري",
      durationDays: 30,
      price: 299,
      isActive: true,
    },
  });

  const planSixMonths = await (prisma as any).subscriptionPlan.upsert({
    where: { code: "SIX_MONTHS" },
    update: {},
    create: {
      code: "SIX_MONTHS",
      name: "نصف سنوي",
      durationDays: 180,
      price: 1499,
      isActive: true,
    },
  });

  const planYearly = await (prisma as any).subscriptionPlan.upsert({
    where: { code: "YEARLY" },
    update: {},
    create: {
      code: "YEARLY",
      name: "سنوي",
      durationDays: 365,
      price: 2499,
      isActive: true,
    },
  });

  // خطة معطلة (سيناريو: خطة تم إيقافها)
  await (prisma as any).subscriptionPlan.upsert({
    where: { code: "LEGACY_BASIC" },
    update: {},
    create: {
      code: "LEGACY_BASIC",
      name: "أساسي (قديم)",
      durationDays: 30,
      price: 99,
      isActive: false,
    },
  });

  console.log("✅  خطط الاشتراك (4 خطط)");

  // ══════════════════════════════════════════════════════════════════════════
  // 3-A. عيادة Alpha ← اشتراك نشط · دفع نسبة مئوية · مع receptionist
  // ══════════════════════════════════════════════════════════════════════════
  const clinicAlpha = await prisma.clinic.upsert({
    where: { slug: "alpha-clinic" },
    update: {},
    create: {
      slug: "alpha-clinic",
      name: "عيادة ألفا للباطنة",
      isActive: true,
      timezone: "Africa/Cairo",
      defaultLocale: "ar",
      workingHours: {
        sat: { open: "09:00", close: "21:00", enabled: true },
        sun: { open: "09:00", close: "21:00", enabled: true },
        mon: { open: "09:00", close: "21:00", enabled: true },
        tue: { open: "09:00", close: "21:00", enabled: true },
        wed: { open: "09:00", close: "21:00", enabled: true },
        thu: { open: "09:00", close: "15:00", enabled: true },
        fri: { open: "00:00", close: "00:00", enabled: false },
      },
    },
  });

  // اشتراك نشط لعيادة Alpha
  await (prisma as any).clinicSubscription.upsert({
    where: { clinicId: clinicAlpha.id },
    update: {},
    create: {
      clinicId: clinicAlpha.id,
      planId: planYearly.id,
      startsAt: daysFromNow(-60),
      expiresAt: daysFromNow(305),
      status: "ACTIVE",
    },
  });

  // دكتور Alpha (DOCTOR_ADMIN) — دفع بنسبة مئوية 20%
  const userDrAlpha = await prisma.user.upsert({
    where: { email: "dr.alpha@demo.test" },
    update: {},
    create: {
      email: "dr.alpha@demo.test",
      fullName: "د. أحمد سالم",
      passwordHash: await pwd(),
    },
  });

  await prisma.clinicUser.upsert({
    where: {
      clinicId_userId: { clinicId: clinicAlpha.id, userId: userDrAlpha.id },
    },
    update: {},
    create: {
      clinicId: clinicAlpha.id,
      userId: userDrAlpha.id,
      role: ClinicRole.DOCTOR_ADMIN,
      specialty: "طب باطني",
      paymentMode: "PERCENTAGE",
      adminPercentage: 20,
      isActive: true,
    },
  });

  // Receptionist لعيادة Alpha
  const userRecAlpha = await prisma.user.upsert({
    where: { email: "rec.alpha@demo.test" },
    update: {},
    create: {
      email: "rec.alpha@demo.test",
      phone: "+201011112222",
      fullName: "مي عبد الله",
      passwordHash: await pwd(),
    },
  });

  await prisma.clinicUser.upsert({
    where: {
      clinicId_userId: { clinicId: clinicAlpha.id, userId: userRecAlpha.id },
    },
    update: {},
    create: {
      clinicId: clinicAlpha.id,
      userId: userRecAlpha.id,
      role: ClinicRole.RECEPTIONIST,
      isActive: true,
    },
  });

  // Receptionist معطل (سيناريو: موظف مغادر)
  const userRecAlphaOld = await prisma.user.upsert({
    where: { email: "rec.alpha.old@demo.test" },
    update: {},
    create: {
      email: "rec.alpha.old@demo.test",
      fullName: "سارة محمود",
      passwordHash: await pwd(),
    },
  });

  await prisma.clinicUser.upsert({
    where: {
      clinicId_userId: { clinicId: clinicAlpha.id, userId: userRecAlphaOld.id },
    },
    update: {},
    create: {
      clinicId: clinicAlpha.id,
      userId: userRecAlphaOld.id,
      role: ClinicRole.RECEPTIONIST,
      isActive: false, // موظف سابق — معطل
    },
  });

  console.log(`✅  عيادة Alpha → ${clinicAlpha.name} (اشتراك نشط · نسبة 20%)`);

  // ══════════════════════════════════════════════════════════════════════════
  // 3-B. عيادة Beta ← اشتراك منتهي · دفع إيجار ثابت · بدون receptionist
  // ══════════════════════════════════════════════════════════════════════════
  const clinicBeta = await prisma.clinic.upsert({
    where: { slug: "beta-clinic" },
    update: {},
    create: {
      slug: "beta-clinic",
      name: "عيادة بيتا للأطفال",
      isActive: true,
      timezone: "Africa/Cairo",
      defaultLocale: "ar",
      workingHours: {
        sat: { open: "10:00", close: "18:00", enabled: true },
        sun: { open: "10:00", close: "18:00", enabled: true },
        mon: { open: "10:00", close: "18:00", enabled: true },
        tue: { open: "10:00", close: "18:00", enabled: true },
        wed: { open: "00:00", close: "00:00", enabled: false },
        thu: { open: "10:00", close: "18:00", enabled: true },
        fri: { open: "00:00", close: "00:00", enabled: false },
      },
    },
  });

  // اشتراك منتهي لعيادة Beta (سيناريو: لم يجدد)
  await (prisma as any).clinicSubscription.upsert({
    where: { clinicId: clinicBeta.id },
    update: {},
    create: {
      clinicId: clinicBeta.id,
      planId: planMonthly.id,
      startsAt: daysFromNow(-60),
      expiresAt: daysFromNow(-1), // انتهى البارحة
      status: "EXPIRED",
    },
  });

  // دكتور Beta (DOCTOR_ADMIN) — دفع إيجار ثابت 3000 شهرياً
  const userDrBeta = await prisma.user.upsert({
    where: { email: "dr.beta@demo.test" },
    update: {},
    create: {
      email: "dr.beta@demo.test",
      phone: "+201099998888",
      fullName: "د. منى خالد",
      passwordHash: await pwd(),
    },
  });

  await prisma.clinicUser.upsert({
    where: {
      clinicId_userId: { clinicId: clinicBeta.id, userId: userDrBeta.id },
    },
    update: {},
    create: {
      clinicId: clinicBeta.id,
      userId: userDrBeta.id,
      role: ClinicRole.DOCTOR_ADMIN,
      specialty: "طب أطفال",
      paymentMode: "FIXED_RENT",
      fixedMonthlyRent: 3000,
      isActive: true,
    },
  });

  // عيادة Beta بدون اشتراك وبدون receptionist — دكتور لوحده
  console.log(
    `✅  عيادة Beta → ${clinicBeta.name} (اشتراك منتهي · إيجار ثابت)`,
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 4. كتالوج أدوية وأشعة
  // ══════════════════════════════════════════════════════════════════════════
  const alphaChk = await prisma.medicationCatalog.findFirst({
    where: { clinicId: clinicAlpha.id, doctorId: userDrAlpha.id },
  });

  if (!alphaChk) {
    await prisma.medicationCatalog.createMany({
      data: [
        {
          clinicId: clinicAlpha.id,
          doctorId: userDrAlpha.id,
          name: "أموكسيسيلين 500mg",
          dose: "500mg",
          frequency: "3 مرات يومياً",
          duration: "7 أيام",
          notes: "بعد الأكل",
        },
        {
          clinicId: clinicAlpha.id,
          doctorId: userDrAlpha.id,
          name: "باراسيتامول 500mg",
          dose: "500mg",
          frequency: "عند الحاجة كل 6 ساعات",
          duration: "حسب الأعراض",
          notes: "حد أقصى 4 جرعات",
        },
        {
          clinicId: clinicAlpha.id,
          doctorId: userDrAlpha.id,
          name: "أوميبرازول 20mg",
          dose: "20mg",
          frequency: "مرة يومياً",
          duration: "30 يوم",
          notes: "قبل الأكل",
        },
        {
          clinicId: clinicAlpha.id,
          doctorId: userDrAlpha.id,
          name: "ميتفورمين 500mg",
          dose: "500mg",
          frequency: "مرتين يومياً",
          duration: "مستمر",
          notes: "مع الأكل",
        },
        {
          clinicId: clinicAlpha.id,
          doctorId: userDrAlpha.id,
          name: "ليفوثيروكسين 50mcg",
          dose: "50mcg",
          frequency: "مرة صباحاً",
          duration: "مستمر",
          notes: "قبل الفطار بنص ساعة",
          isActive: false,
        },
      ],
    });

    await prisma.imagingCatalog.createMany({
      data: [
        {
          clinicId: clinicAlpha.id,
          doctorId: userDrAlpha.id,
          name: "أشعة صدر AP",
          category: "X-Ray",
          notes: "وقوف",
        },
        {
          clinicId: clinicAlpha.id,
          doctorId: userDrAlpha.id,
          name: "سونار بطن كامل",
          category: "Ultrasound",
        },
        {
          clinicId: clinicAlpha.id,
          doctorId: userDrAlpha.id,
          name: "CT صدر بدون حقن",
          category: "CT",
        },
        {
          clinicId: clinicAlpha.id,
          doctorId: userDrAlpha.id,
          name: "MRI رأس",
          category: "MRI",
        },
      ],
    });
  }

  const betaChk = await prisma.medicationCatalog.findFirst({
    where: { clinicId: clinicBeta.id, doctorId: userDrBeta.id },
  });
  if (!betaChk) {
    await prisma.medicationCatalog.createMany({
      data: [
        {
          clinicId: clinicBeta.id,
          doctorId: userDrBeta.id,
          name: "أموكسيسيلين شراب 250mg/5ml",
          dose: "5ml",
          frequency: "3 مرات يومياً",
          duration: "7 أيام",
          notes: "رج قبل الاستخدام",
        },
        {
          clinicId: clinicBeta.id,
          doctorId: userDrBeta.id,
          name: "إيبوبروفين 100mg/5ml",
          dose: "حسب الوزن",
          frequency: "كل 8 ساعات",
          duration: "5 أيام",
          notes: "بعد الأكل",
        },
        {
          clinicId: clinicBeta.id,
          doctorId: userDrBeta.id,
          name: "سيتريزين شراب",
          dose: "5ml",
          frequency: "مرة ليلاً",
          duration: "10 أيام",
        },
      ],
    });
  }
  console.log("✅  كتالوج أدوية وأشعة");

  // ══════════════════════════════════════════════════════════════════════════
  // 5. قوالب روشتات
  // ══════════════════════════════════════════════════════════════════════════
  const tmplChk = await (prisma as any).prescriptionTemplate.findFirst({
    where: { clinicId: clinicAlpha.id, doctorId: userDrAlpha.id },
  });
  if (!tmplChk) {
    await (prisma as any).prescriptionTemplate.create({
      data: {
        clinicId: clinicAlpha.id,
        doctorId: userDrAlpha.id,
        title: "روشتة عيادة ألفا",
        header: {
          clinicName: "عيادة ألفا للباطنة",
          doctorName: "د. أحمد سالم",
          specialty: "استشاري طب باطني",
          phone: "+201012345678",
          address: "القاهرة - مدينة نصر",
        },
        footer: {
          notes: "يُرجى الالتزام بمواعيد الدواء وإعادة الكشف بعد أسبوعين",
        },
        isDefault: true,
      },
    });
  }
  console.log("✅  قوالب روشتات");

  // ══════════════════════════════════════════════════════════════════════════
  // 6. مرضى عيادة Alpha
  // ══════════════════════════════════════════════════════════════════════════
  const alphaPatientsChk = await prisma.patient.count({
    where: { clinicId: clinicAlpha.id },
  });

  let pA1: any, pA2: any, pA3: any, pA4: any, pA5: any, pA6: any, pA7: any;

  if (alphaPatientsChk === 0) {
    // مريض 1 — بيانات كاملة + ملاحظات
    pA1 = await prisma.patient.create({
      data: {
        clinicId: clinicAlpha.id,
        createdById: userDrAlpha.id,
        code: patientCode(1),
        fullName: "محمد علي حسن",
        phone: "+201012345678",
        dateOfBirth: new Date("1985-06-15"),
        medicalNotes:
          "مريض بالسكري النوع الثاني · حساسية من البنسيلين · ضغط مرتفع",
      },
    });

    // مريض 2 — بدون هاتف
    pA2 = await prisma.patient.create({
      data: {
        clinicId: clinicAlpha.id,
        createdById: userRecAlpha.id,
        code: patientCode(2),
        fullName: "فاطمة إبراهيم عمر",
        dateOfBirth: new Date("1992-11-03"),
        medicalNotes: "ربو خفيف · تأخذ بخاخ سالبوتامول عند الحاجة",
      },
    });

    // مريض 3 — بيانات مبسطة جداً
    pA3 = await prisma.patient.create({
      data: {
        clinicId: clinicAlpha.id,
        createdById: userRecAlpha.id,
        code: patientCode(3),
        fullName: "خالد عبد الرحمن",
        phone: "+201099991234",
      },
    });

    // مريض 4 — شاب بدون ملاحظات
    pA4 = await prisma.patient.create({
      data: {
        clinicId: clinicAlpha.id,
        createdById: userDrAlpha.id,
        code: patientCode(4),
        fullName: "يوسف مصطفى النجار",
        phone: "+201155556666",
        dateOfBirth: new Date("2000-01-20"),
      },
    });

    // مريض 5 — مسنة تحتاج متابعة مستمرة
    pA5 = await prisma.patient.create({
      data: {
        clinicId: clinicAlpha.id,
        createdById: userDrAlpha.id,
        code: patientCode(5),
        fullName: "سهير محمود البكر",
        phone: "+201277778888",
        dateOfBirth: new Date("1955-03-08"),
        medicalNotes:
          "ضغط مرتفع مزمن · قصور كلوي خفيف · لا تتحمل مضادات الالتهاب",
      },
    });

    // مريض 6 — walk-in جديد (بيانات ناقصة)
    pA6 = await prisma.patient.create({
      data: {
        clinicId: clinicAlpha.id,
        createdById: userRecAlpha.id,
        code: patientCode(6),
        fullName: "عمر حسين",
        phone: "+201033334444",
      },
    });

    // مريض 7 — مريض مجهول الاتصال (تسجيل طارئ)
    pA7 = await prisma.patient.create({
      data: {
        clinicId: clinicAlpha.id,
        createdById: userRecAlpha.id,
        code: patientCode(7),
        fullName: "سمر وليد",
      },
    });

    // مرفق لمريض 1
    await prisma.patientAttachment.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA1.id,
        storageKey: "attachments/alpha/p0001/labs-2024.pdf",
        fileName: "تحاليل السكر والكلى - يناير 2024.pdf",
        mimeType: "application/pdf",
      },
    });

    await prisma.patientAttachment.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA1.id,
        storageKey: "attachments/alpha/p0001/ecg.jpg",
        fileName: "رسم قلب.jpg",
        mimeType: "image/jpeg",
      },
    });
  } else {
    // إذا موجود — جيب المرضى الموجودين
    const existing = await prisma.patient.findMany({
      where: { clinicId: clinicAlpha.id },
      orderBy: { createdAt: "asc" },
      take: 7,
    });
    [pA1, pA2, pA3, pA4, pA5, pA6, pA7] = existing;
  }
  console.log("✅  مرضى عيادة Alpha (7 مرضى)");

  // ══════════════════════════════════════════════════════════════════════════
  // 7. مواعيد عيادة Alpha — كل الحالات الممكنة
  // ══════════════════════════════════════════════════════════════════════════
  const apptChk = await prisma.appointment.count({
    where: { clinicId: clinicAlpha.id },
  });

  let apptInProgress: any, apptCompleted1: any;

  if (apptChk === 0 && pA1 && pA2 && pA3 && pA4 && pA5 && pA6 && pA7) {
    // ── اليوم ─────────────────────────────────────────────────────────────

    // 1. IN_QUEUE — مريض في القائمة لسه
    await prisma.appointment.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA1.id,
        doctorId: userDrAlpha.id,
        startsAt: todayAt(9, 0),
        endsAt: todayAt(9, 30),
        status: AppointmentStatus.IN_QUEUE,
        visitType: "NEW_VISIT",
        notes: "مراجعة دورية للسكر والضغط",
      },
    });

    // 2. IN_PROGRESS — الدكتور بيكشف عليه دلوقتي
    apptInProgress = await prisma.appointment.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA2.id,
        doctorId: userDrAlpha.id,
        startsAt: todayAt(9, 30),
        endsAt: todayAt(10, 0),
        status: AppointmentStatus.IN_PROGRESS,
        visitType: "FOLLOW_UP",
      },
    });

    // 3. IN_QUEUE — حجز مسبق لبعدين ولسه في الانتظار
    await prisma.appointment.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA3.id,
        doctorId: userDrAlpha.id,
        startsAt: todayAt(11, 0),
        endsAt: todayAt(11, 30),
        status: AppointmentStatus.IN_QUEUE,
        visitType: "NEW_VISIT",
      },
    });

    // 4. IN_QUEUE — وصل العيادة ولسه في الانتظار
    await prisma.appointment.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA4.id,
        doctorId: userDrAlpha.id,
        startsAt: todayAt(10, 0),
        endsAt: todayAt(10, 30),
        status: AppointmentStatus.IN_QUEUE,
        visitType: "NEW_VISIT",
        notes: "كشف أول مرة",
      },
    });

    // 5. COMPLETED — اتخلص من الكشف
    apptCompleted1 = await prisma.appointment.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA5.id,
        doctorId: userDrAlpha.id,
        startsAt: todayAt(8, 0),
        endsAt: todayAt(8, 30),
        status: AppointmentStatus.COMPLETED,
        visitType: "FOLLOW_UP",
      },
    });

    // 6. CANCELLED — اتلغى
    await prisma.appointment.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA6.id,
        doctorId: userDrAlpha.id,
        startsAt: todayAt(12, 0),
        endsAt: todayAt(12, 30),
        status: AppointmentStatus.CANCELLED,
        visitType: "NEW_VISIT",
        notes: "إلغاء من قبل المريض",
      },
    });

    // 7. CANCELLED — المريض ما دخلش الكشف
    await prisma.appointment.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA7.id,
        doctorId: userDrAlpha.id,
        startsAt: todayAt(7, 30),
        endsAt: todayAt(8, 0),
        status: AppointmentStatus.CANCELLED,
        visitType: "NEW_VISIT",
      },
    });

    // ── مواعيد مستقبلية ───────────────────────────────────────────────────

    // حجز بكره
    await prisma.appointment.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA1.id,
        doctorId: userDrAlpha.id,
        startsAt: daysFromNow(1),
        endsAt: new Date(daysFromNow(1).getTime() + 30 * 60000),
        status: AppointmentStatus.IN_QUEUE,
        visitType: "FOLLOW_UP",
        notes: "متابعة نتيجة التحاليل",
      },
    });

    // حجز بعد أسبوع
    await prisma.appointment.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA3.id,
        doctorId: userDrAlpha.id,
        startsAt: daysFromNow(7),
        endsAt: new Date(daysFromNow(7).getTime() + 30 * 60000),
        status: AppointmentStatus.IN_QUEUE,
        visitType: "NEW_VISIT",
      },
    });

    // ── مواعيد ماضية ─────────────────────────────────────────────────────

    // أسبوع فات — completed
    const weekAgo = daysFromNow(-7);
    weekAgo.setHours(10, 0, 0, 0);
    const weekAgoEnd = new Date(weekAgo.getTime() + 30 * 60000);

    await prisma.appointment.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA1.id,
        doctorId: userDrAlpha.id,
        startsAt: weekAgo,
        endsAt: weekAgoEnd,
        status: AppointmentStatus.COMPLETED,
        visitType: "NEW_VISIT",
      },
    });

    // شهر فات — completed + فاتورة تاريخية
    const monthAgo = daysFromNow(-30);
    monthAgo.setHours(9, 0, 0, 0);
    const monthAgoEnd = new Date(monthAgo.getTime() + 30 * 60000);

    const oldAppt = await prisma.appointment.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA5.id,
        doctorId: userDrAlpha.id,
        startsAt: monthAgo,
        endsAt: monthAgoEnd,
        status: AppointmentStatus.COMPLETED,
        visitType: "FOLLOW_UP",
      },
    });

    // ── الفواتير ──────────────────────────────────────────────────────────
    // فاتورة لموعد مكتمل اليوم — cash
    await prisma.invoice.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA5.id,
        appointmentId: apptCompleted1.id,
        issuedById: userDrAlpha.id,
        paymentMethod: "cash",
        status: "PAID",
        totalAmount: 300,
        services: [{ name: "كشف متابعة", amount: 300 }],
      },
    });

    // فاتورة تاريخية — card
    await prisma.invoice.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA5.id,
        appointmentId: oldAppt.id,
        issuedById: userDrAlpha.id,
        paymentMethod: "card",
        status: "PAID",
        totalAmount: 350,
        services: [
          { name: "كشف متابعة", amount: 300 },
          { name: "تحليل سريع", amount: 50 },
        ],
      },
    });

    // فاتورة walk-in بدون موعد — insurance
    await prisma.invoice.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA1.id,
        issuedById: userRecAlpha.id,
        paymentMethod: "insurance",
        status: "PAID",
        totalAmount: 150,
        services: [{ name: "كشف تأمين", amount: 150 }],
      },
    });

    // ── الروشتات ──────────────────────────────────────────────────────────
    // روشتة لموعد الـ IN_PROGRESS
    await prisma.prescription.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA2.id,
        doctorId: userDrAlpha.id,
        diagnosis: "نزلة برد حادة مع التهاب حلق",
        medications: {
          medications: [
            {
              name: "أموكسيسيلين 500mg",
              dose: "500mg",
              frequency: "3 مرات يومياً",
              duration: "7 أيام",
              notes: "بعد الأكل",
            },
            {
              name: "باراسيتامول 500mg",
              dose: "500mg",
              frequency: "عند الحاجة",
              duration: "5 أيام",
            },
          ],
          notes: "الراحة التامة وشرب السوائل",
          requestedTests: ["CBC", "CRP"],
          requestedImaging: [],
        },
      },
    });

    // روشتة قديمة لمريض 1
    await prisma.prescription.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA1.id,
        doctorId: userDrAlpha.id,
        diagnosis: "سكري نوع 2 غير منضبط",
        medications: {
          medications: [
            {
              name: "ميتفورمين 500mg",
              dose: "500mg",
              frequency: "مرتين يومياً",
              duration: "مستمر",
              notes: "مع الأكل",
            },
            {
              name: "أوميبرازول 20mg",
              dose: "20mg",
              frequency: "مرة صباحاً",
              duration: "30 يوم",
              notes: "قبل الفطار",
            },
          ],
          notes: "اتباع نظام غذائي صارم — تقليل السكريات والنشويات",
          requestedTests: ["HbA1c", "Creatinine", "Lipid Profile"],
          requestedImaging: ["سونار بطن كامل"],
        },
        issuedAt: daysFromNow(-30),
      },
    });

    // روشتة بدون أدوية (تحاليل وأشعة فقط)
    await prisma.prescription.create({
      data: {
        clinicId: clinicAlpha.id,
        patientId: pA5.id,
        doctorId: userDrAlpha.id,
        diagnosis: "تقييم دوري",
        medications: {
          medications: [],
          notes: "فحص دوري شامل",
          requestedTests: ["CBC", "LFT", "RFT", "TSH", "Urine Analysis"],
          requestedImaging: ["أشعة صدر AP"],
        },
        issuedAt: daysFromNow(-30),
      },
    });

    console.log("✅  مواعيد Alpha (9 مواعيد) + فواتير (3) + روشتات (3)");
  } else {
    console.log("ℹ️   مواعيد Alpha — موجودة بالفعل، تم التخطي");
    // جيب أول موعد completed لو موجود
    apptCompleted1 = await prisma.appointment.findFirst({
      where: { clinicId: clinicAlpha.id, status: AppointmentStatus.COMPLETED },
    });
    apptInProgress = await prisma.appointment.findFirst({
      where: {
        clinicId: clinicAlpha.id,
        status: AppointmentStatus.IN_PROGRESS,
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 8. مرضى ومواعيد عيادة Beta
  // ══════════════════════════════════════════════════════════════════════════
  const betaPatientsChk = await prisma.patient.count({
    where: { clinicId: clinicBeta.id },
  });

  if (betaPatientsChk === 0) {
    const pB1 = await prisma.patient.create({
      data: {
        clinicId: clinicBeta.id,
        createdById: userDrBeta.id,
        code: patientCode(1),
        fullName: "آدم طارق سعد",
        phone: "+201066667777",
        dateOfBirth: new Date("2019-05-10"),
        medicalNotes: "ولد عمره 5 سنين · تأخر في الكلام",
      },
    });

    const pB2 = await prisma.patient.create({
      data: {
        clinicId: clinicBeta.id,
        createdById: userDrBeta.id,
        code: patientCode(2),
        fullName: "لينا عصام فريد",
        dateOfBirth: new Date("2021-09-22"),
      },
    });

    // موعد اليوم في عيادة Beta
    await prisma.appointment.create({
      data: {
        clinicId: clinicBeta.id,
        patientId: pB1.id,
        doctorId: userDrBeta.id,
        startsAt: todayAt(10, 0),
        endsAt: todayAt(10, 20),
        status: AppointmentStatus.IN_QUEUE,
        visitType: "NEW_VISIT",
      },
    });

    await prisma.appointment.create({
      data: {
        clinicId: clinicBeta.id,
        patientId: pB2.id,
        doctorId: userDrBeta.id,
        startsAt: todayAt(10, 30),
        endsAt: todayAt(10, 50),
        status: AppointmentStatus.IN_QUEUE,
        visitType: "FOLLOW_UP",
      },
    });

    console.log("✅  مرضى ومواعيد عيادة Beta");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 9. طلبات الاشتراك — كل الحالات
  // ══════════════════════════════════════════════════════════════════════════
  const reqChk = await (prisma as any).subscriptionPaymentRequest.count({
    where: { clinicId: clinicAlpha.id },
  });

  if (reqChk === 0) {
    // طلب PENDING (لسه ما راجعهوش)
    await (prisma as any).subscriptionPaymentRequest.create({
      data: {
        clinicId: clinicAlpha.id,
        planId: planYearly.id,
        requestedById: userDrAlpha.id,
        transferPhone: "+201012345678",
        screenshotUrl: "https://placehold.co/600x400?text=Payment+Screenshot",
        notes: "تجديد سنوي — تحويل على إنستاباي",
        status: "PENDING",
      },
    });

    // طلب APPROVED (وافق عليه السوبر ادمن)
    await (prisma as any).subscriptionPaymentRequest.create({
      data: {
        clinicId: clinicAlpha.id,
        planId: planSixMonths.id,
        requestedById: userDrAlpha.id,
        transferPhone: "+201012345678",
        screenshotUrl: "https://placehold.co/600x400?text=Payment+Screenshot+2",
        status: "APPROVED",
        reviewedById: superAdmin.id,
        reviewedAt: daysFromNow(-60),
        createdAt: daysFromNow(-61),
        updatedAt: daysFromNow(-60),
      },
    });

    // طلب REJECTED (رفضه السوبر ادمن)
    await (prisma as any).subscriptionPaymentRequest.create({
      data: {
        clinicId: clinicBeta.id,
        planId: planMonthly.id,
        requestedById: userDrBeta.id,
        transferPhone: "+201099998888",
        screenshotUrl: "https://placehold.co/600x400?text=Bad+Screenshot",
        status: "REJECTED",
        reviewedById: superAdmin.id,
        reviewedAt: daysFromNow(-5),
        rejectionReason: "الصورة غير واضحة — يُرجى إعادة الإرسال",
        createdAt: daysFromNow(-6),
        updatedAt: daysFromNow(-5),
      },
    });

    console.log("✅  طلبات الاشتراك (pending / approved / rejected)");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 10. إشعارات
  // ══════════════════════════════════════════════════════════════════════════
  const notifChk = await prisma.notification.count({
    where: { userId: userDrAlpha.id },
  });

  if (notifChk === 0) {
    // إشعار مقروء
    await prisma.notification.create({
      data: {
        userId: userDrAlpha.id,
        type: "SUBSCRIPTION_APPROVED",
        title: "تم قبول طلب الاشتراك ✓",
        body: 'تم تفعيل باقة "نصف سنوي" بنجاح. يمكنك الاستمرار في استخدام المنصة.',
        isRead: true,
        meta: { planName: "نصف سنوي", approved: true },
      },
    });

    // إشعار غير مقروء
    await prisma.notification.create({
      data: {
        userId: userDrAlpha.id,
        type: "SUBSCRIPTION_PAYMENT_REQUESTED",
        title: "طلب تجديد اشتراك جديد 💳",
        body: 'عيادة "عيادة ألفا للباطنة" تطلب تجديد الاشتراك على باقة "سنوي".',
        isRead: false,
        meta: {
          clinicId: clinicAlpha.id,
          link: "/dashboard/super-admin/subscription-requests",
        },
      },
    });

    // إشعار تمديد مجاني
    await prisma.notification.create({
      data: {
        userId: userDrAlpha.id,
        type: "SUBSCRIPTION_EXTENDED",
        title: "تم تمديد اشتراكك 🎁",
        body: "تمت إضافة 10 أيام إضافية لاشتراكك كمكافأة إحالة.",
        isRead: false,
        meta: { days: 10 },
      },
    });

    // إشعار للسوبر ادمن
    await prisma.notification.create({
      data: {
        userId: superAdmin.id,
        type: "SUBSCRIPTION_PAYMENT_REQUESTED",
        title: "طلب تجديد اشتراك جديد 💳",
        body: 'عيادة "عيادة ألفا للباطنة" تطلب تجديد الاشتراك. اضغط للمراجعة.',
        isRead: false,
        meta: {
          clinicId: clinicAlpha.id,
          link: "/dashboard/super-admin/subscription-requests",
        },
      },
    });

    console.log("✅  إشعارات (4 إشعارات)");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 11. Audit Logs نماذجية
  // ══════════════════════════════════════════════════════════════════════════
  const auditChk = await prisma.auditLog.count({
    where: { clinicId: clinicAlpha.id },
  });

  if (auditChk === 0) {
    await prisma.auditLog.createMany({
      data: [
        {
          clinicId: clinicAlpha.id,
          actorId: superAdmin.id,
          action: "CLINIC_CREATED",
          entityType: "Clinic",
          entityId: clinicAlpha.id,
          meta: { slug: "alpha-clinic" },
        },
        {
          clinicId: clinicAlpha.id,
          actorId: userDrAlpha.id,
          action: "PATIENT_CREATED",
          entityType: "Patient",
          meta: { code: patientCode(1) },
        },
        {
          clinicId: clinicAlpha.id,
          actorId: userRecAlpha.id,
          action: "APPOINTMENT_CREATED",
          entityType: "Appointment",
          meta: { visitType: "NEW_VISIT" },
        },
        {
          clinicId: clinicAlpha.id,
          actorId: userDrAlpha.id,
          action: "PRESCRIPTION_CREATED",
          entityType: "Prescription",
        },
        {
          clinicId: clinicAlpha.id,
          actorId: userDrAlpha.id,
          action: "INVOICE_CREATED",
          entityType: "Invoice",
          meta: { totalAmount: 300 },
        },
        {
          clinicId: clinicAlpha.id,
          actorId: superAdmin.id,
          action: "SUBSCRIPTION_PAYMENT_APPROVED",
          entityType: "SubscriptionPaymentRequest",
          meta: { planId: planSixMonths.id },
        },
        {
          clinicId: clinicBeta.id,
          actorId: superAdmin.id,
          action: "SUBSCRIPTION_PAYMENT_REJECTED",
          entityType: "SubscriptionPaymentRequest",
          meta: { reason: "صورة غير واضحة" },
        },
        {
          actorId: superAdmin.id,
          action: "SUPER_ADMIN_LOGIN",
          entityType: "User",
          entityId: superAdmin.id,
        },
      ],
    });
    console.log("✅  Audit logs (8 سجلات)");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ملخص بيانات الدخول
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                  🌱  Seed مكتمل بنجاح                   ║
╠══════════════════════════════════════════════════════════╣
║  كلمة السر لكل المستخدمين: Password123!                 ║
╠══════════════════════════════════════════════════════════╣
║  SUPER ADMIN                                             ║
║    super@demo.test                                       ║
╠══════════════════════════════════════════════════════════╣
║  عيادة ALPHA — اشتراك نشط · نسبة 20%                   ║
║    دكتور:       dr.alpha@demo.test                       ║
║    receptionist: rec.alpha@demo.test / +201011112222      ║
╠══════════════════════════════════════════════════════════╣
║  عيادة BETA — اشتراك منتهي · إيجار ثابت 3000           ║
║    دكتور:       dr.beta@demo.test  / +201099998888       ║
╚══════════════════════════════════════════════════════════╝
`);
}

main()
  .catch((e) => {
    console.error("❌  Seed فشل:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
