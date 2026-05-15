import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ClinicRole } from "@prisma/client";
import { CurrentUser } from "../../core/auth/decorators/current-user.decorator";
import { Roles } from "../../core/auth/decorators/roles.decorator";
import { RolesGuard } from "../../core/auth/guards/roles.guard";
import { Permission } from "../../core/auth/rbac/role-permissions";
import { Permissions } from "../../core/auth/rbac/permissions.decorator";
import { RequestUser } from "../../core/auth/types/request-user.type";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { PatientsService } from "./patients.service";
import { UploadService } from "../../core/upload/upload.service";

@Controller("patients")
@UseGuards(RolesGuard)
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly uploadService: UploadService,
  ) {}

  @Get()
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.RECEPTIONIST)
  @Permissions(Permission.VIEW_PATIENT_DATA, Permission.VIEW_SCHEDULE)
  async list(
    @CurrentUser() user: RequestUser,
    @Query("q") q?: string,
    @Query("doctorId") doctorId?: string,
  ) {
    return this.patientsService.listByClinic(user, q, doctorId);
  }

  @Get("similar")
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.RECEPTIONIST)
  @Permissions(Permission.VIEW_PATIENT_DATA)
  async similar(@CurrentUser() user: RequestUser, @Query("name") name: string) {
    return this.patientsService.findSimilar(user, name ?? "");
  }

  @Get(":patientId")
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.RECEPTIONIST)
  @Permissions(Permission.VIEW_PATIENT_DATA, Permission.VIEW_PATIENT_HISTORY)
  async details(
    @CurrentUser() user: RequestUser,
    @Param("patientId") patientId: string,
  ) {
    return this.patientsService.getDetails(user.clinicId!, patientId, user);
  }

  @Post()
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.RECEPTIONIST)
  @Permissions(Permission.CREATE_PATIENT)
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePatientDto,
  ) {
    return this.patientsService.create(user, dto);
  }

  @Post(":patientId/attachments")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.VIEW_PATIENT_HISTORY)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async addAttachment(
    @CurrentUser() user: RequestUser,
    @Param("patientId") patientId: string,
    @Query("appointmentId") appointmentId: string | undefined,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    // Max 5 files per patient
    const fileCount = await this.patientsService.countAttachments(
      user.clinicId!,
      patientId,
    );
    if (fileCount >= 5)
      throw new BadRequestException("Max 5 files per patient");
    const url = await this.uploadService.uploadPatientFile(
      file.buffer,
      file.mimetype,
      `${patientId}-${user.userId}`,
    );
    return this.patientsService.addAttachment(
      user,
      patientId,
      {
        url,
        fileName: file.originalname,
        mimeType: file.mimetype,
      },
      appointmentId,
    );
  }
}
