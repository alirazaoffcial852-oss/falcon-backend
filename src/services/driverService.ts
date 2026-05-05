import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import type { DriverListQuery, Driver } from "../types/admin/driver";
import { buildWhereCondition } from "../utils/buildWhereCondition";
import bcrypt from "bcryptjs";
// import { sendCredentialEmail } from "../utils/email"; // Keep for later use

export class DriverService {
  private db = DatabaseService.getInstance().getPrisma();

  private async getDriverRoleId(): Promise<number> {
    const driverRole = await this.db.role.findUnique({
      where: { name: "driver" },
      select: { id: true },
    });

    if (!driverRole) {
      throw ResponseHandler.badRequest("Driver role not found in roles table");
    }

    return driverRole.id;
  }

  private async ensureCarsExist(carIds: number[]): Promise<void> {
    if (!carIds.length) return;
    const rows = await this.db.car.findMany({
      where: { id: { in: carIds } },
      select: { id: true },
    });
    const found = new Set(rows.map((x) => x.id));
    const missing = carIds.filter((id) => !found.has(id));
    if (missing.length) {
      throw ResponseHandler.badRequest(
        `Car with ID ${missing[0]} does not exist`,
      );
    }
  }

  private normalizeCars(data: Driver): { carIds: number[]; defaultCarId: number } {
    const fromList = Array.isArray(data.car_ids)
      ? data.car_ids
          .map((x) => Number(x))
          .filter((x) => Number.isInteger(x) && x > 0)
      : [];
    const fromSingle =
      data.car_id !== undefined && data.car_id !== null ? [Number(data.car_id)] : [];
    const carIds = [...new Set([...fromList, ...fromSingle])];
    if (!carIds.length) {
      throw ResponseHandler.badRequest("At least one car id is required");
    }
    const requestedDefault =
      data.default_car_id !== undefined && data.default_car_id !== null
        ? Number(data.default_car_id)
        : null;
    const defaultCarId = requestedDefault ?? carIds[0];
    if (!carIds.includes(defaultCarId)) {
      throw ResponseHandler.badRequest("default_car_id must exist in car_ids");
    }
    return { carIds, defaultCarId };
  }

  private async setDriverCars(
    tx: {
      driverAssignCar: {
        deleteMany(args: { where: { driver_id: number } }): Promise<unknown>;
        createMany(args: {
          data: { driver_id: number; car_id: number; is_default: boolean }[];
        }): Promise<unknown>;
      };
    },
    driverId: number,
    carIds: number[],
    defaultCarId: number,
  ): Promise<void> {
    await tx.driverAssignCar.deleteMany({ where: { driver_id: driverId } });
    await tx.driverAssignCar.createMany({
      data: carIds.map((carId) => ({
        driver_id: driverId,
        car_id: carId,
        is_default: carId === defaultCarId,
      })),
    });
  }

  private mapDriverWithCars<T extends {
    driver_assign_cars: Array<{
      car_id: number;
      is_default: boolean;
      car: { id: number; name: string; car_no: string } | null;
    }>;
    user?: { email: string } | null;
  }>(driver: T) {
    const defaultAssigned =
      driver.driver_assign_cars.find((x) => x.is_default) ?? driver.driver_assign_cars[0];
    return {
      ...driver,
      car_id: defaultAssigned?.car_id ?? null,
      car_name: defaultAssigned?.car?.name ?? null,
      car_number: defaultAssigned?.car?.car_no ?? null,
      car_ids: driver.driver_assign_cars.map((x) => x.car_id),
      default_car_id: defaultAssigned?.car_id ?? null,
      cars: driver.driver_assign_cars.map((x) => ({
        id: x.car_id,
        is_default: x.is_default,
        name: x.car?.name ?? null,
        car_no: x.car?.car_no ?? null,
      })),
      driver_assign_cars: undefined,
      email: driver.user?.email ?? null,
    };
  }

  private async createApprovedDriver(data: Driver): Promise<Driver> {
    if (!data.email) {
      throw ResponseHandler.badRequest("Email is required");
    }
    if (!data.password || !data.confirmPassword) {
      throw ResponseHandler.badRequest(
        "password and confirmPassword are required",
      );
    }
    if (data.password !== data.confirmPassword) {
      throw ResponseHandler.badRequest("confirmPassword must match password");
    }
    const email = data.email.trim().toLowerCase();
    const existingUser = await this.db.user.findUnique({ where: { email } });
    if (existingUser) {
      throw ResponseHandler.duplicateResource("User", "email");
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const { carIds, defaultCarId } = this.normalizeCars(data);
    await this.ensureCarsExist(carIds);

    const driver = await this.db.$transaction(async (tx) => {
      const driverRoleId = await this.getDriverRoleId();

      const createdUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role_id: driverRoleId,
        },
      });

      const createdDriver = await tx.driver.create({
        data: {
          user_id: createdUser.id,
          name: data.name,
          phone_no: data.phone_no?.trim() ? data.phone_no.trim() : null,
          address: data.address,
          ...(data.home_lat !== undefined &&
            data.home_lat !== null && { home_lat: Number(data.home_lat) }),
          ...(data.home_long !== undefined &&
            data.home_long !== null && { home_long: Number(data.home_long) }),
          emergency_phone_no: data.emergency_phone_no,
          driver_image_url: data.driver_image_url ?? "",
          rate_per_km:
            data.rate_per_km !== undefined && data.rate_per_km !== null
              ? Number(data.rate_per_km)
              : 0,
          driver_cnic_front_url: data.driver_cnic_front_url ?? "",
          driver_cnic_back_url: data.driver_cnic_back_url ?? "",
          driver_license_front_url: data.driver_license_front_url ?? "",
          driver_license_back_url: data.driver_license_back_url ?? "",
          status: "APPROVED",
        },
      });

      await this.setDriverCars(tx, createdDriver.id, carIds, defaultCarId);

      return createdDriver;
    });

    // await sendCredentialEmail(email, "driver", data.password);

    return {
      email,
      ...driver,
      car_id: defaultCarId,
      car_ids: carIds,
      default_car_id: defaultCarId,
    };
  }

  private async createPendingDriver(data: Driver): Promise<{ id: number }> {
    const { carIds, defaultCarId } = this.normalizeCars(data);
    await this.ensureCarsExist(carIds);

    const driver = await this.db.driver.create({
      data: {
        name: data.name,
        phone_no: data.phone_no?.trim() ? data.phone_no.trim() : null,
        address: data.address,
        ...(data.home_lat !== undefined &&
          data.home_lat !== null && { home_lat: Number(data.home_lat) }),
        ...(data.home_long !== undefined &&
          data.home_long !== null && { home_long: Number(data.home_long) }),
        emergency_phone_no: data.emergency_phone_no,
        driver_image_url: data.driver_image_url ?? "",
        rate_per_km:
          data.rate_per_km !== undefined && data.rate_per_km !== null
            ? Number(data.rate_per_km)
            : 0,
        driver_cnic_front_url: data.driver_cnic_front_url ?? "",
        driver_cnic_back_url: data.driver_cnic_back_url ?? "",
        driver_license_front_url: data.driver_license_front_url ?? "",
        driver_license_back_url: data.driver_license_back_url ?? "",
        status: "PENDING",
      },
      select: { id: true },
    });

    await this.setDriverCars(this.db, driver.id, carIds, defaultCarId);
    return driver;
  }

  async list(params: DriverListQuery) {
    const where = buildWhereCondition(params, [
      "name",
      "address",
      "phone_no",
      "emergency_phone_no",
    ]);
    const total = await this.db.driver.count({ where });
    const drivers = await this.db.driver.findMany({
      where,
      take: params.limit,
      skip: (params.page - 1) * params.limit,
      orderBy: { created_at: "desc" },
      include: {
        driver_assign_cars: {
          orderBy: [{ is_default: "desc" }, { created_at: "desc" }],
          include: { car: true },
        },
        user: { select: { email: true } },
      },
    });
    const data = drivers.map((driver) => {
      return this.mapDriverWithCars(driver);
    });
    return {
      data,
      pagination: {
        total,
        page: params.page,
        limit: params.limit,
        total_pages: Math.ceil(total / params.limit),
      },
    };
  }

  async getById(id: number) {
    const driver = await this.db.driver.findUnique({
      where: { id },
      include: {
        driver_assign_cars: {
          orderBy: [{ is_default: "desc" }, { created_at: "desc" }],
          include: { car: true },
        },
        user: { select: { email: true } },
      },
    });
    if (!driver)
      throw ResponseHandler.notFound("No driver found against this id: " + id);
    return this.mapDriverWithCars(driver);
  }

  async create(
    data: Driver,
    context?: { requesterRole?: string; requesterUserId?: number },
  ): Promise<Driver | { request_id: number; status: string; message: string }> {
    if (context?.requesterRole === "driver") {
      const prisma = this.db as any;
      const pendingDriver = await this.createPendingDriver(data);
      const req = await prisma.driverCreateRequest.create({
        data: {
          requested_by_user_id: context.requesterUserId ?? null,
          payload: data as unknown as object,
          status: "PENDING",
          created_driver_id: pendingDriver.id,
        },
      });
      return {
        request_id: req.id,
        status: req.status,
        message:
          "Driver creation request submitted with pending status. Admin approval is required.",
      };
    }
    return this.createApprovedDriver(data);
  }

  async approveCreateRequest(
    requestId: number,
    adminUserId: number,
    password: string,
    confirmPassword: string,
  ) {
    if (password !== confirmPassword) {
      throw ResponseHandler.badRequest("confirmPassword must match password");
    }
    const prisma = this.db as any;
    const req = await prisma.driverCreateRequest.findUnique({
      where: { id: requestId },
    });
    if (!req)
      throw ResponseHandler.notFound("Driver create request", requestId);
    if (req.status !== "PENDING") {
      throw ResponseHandler.badRequest("This request is already reviewed");
    }
    const payload = req.payload as unknown as Driver;
    let created: Driver;
    if (req.created_driver_id) {
      if (!payload.email) {
        throw ResponseHandler.badRequest(
          "Cannot approve request: email missing in payload",
        );
      }
      const email = payload.email.trim().toLowerCase();
      const existingUser = await this.db.user.findUnique({ where: { email } });
      if (existingUser) {
        throw ResponseHandler.duplicateResource("User", "email");
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const approved = await this.db.$transaction(async (tx) => {
        const driverRoleId = await this.getDriverRoleId();

        const createdUser = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            role_id: driverRoleId,
          },
        });
        return tx.driver.update({
          where: { id: req.created_driver_id },
          data: {
            user_id: createdUser.id,
            status: "APPROVED",
          },
        });
      });
      // await sendCredentialEmail(email, "driver", password);
      created = {
        email,
        ...approved,
      };
    } else {
      created = await this.createApprovedDriver(payload);
    }
    await prisma.driverCreateRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        reviewed_by_user_id: adminUserId,
        reviewed_at: new Date(),
        created_driver_id: created.id,
      },
    });
    return created;
  }

  async listCreateRequests(params: {
    page: number;
    limit: number;
    status?: "PENDING" | "APPROVED";
  }) {
    const where =
      params.status && params.status.length > 0
        ? { status: params.status }
        : undefined;
    const prisma = this.db as any;
    const total = await prisma.driverCreateRequest.count({ where });
    const rows = await prisma.driverCreateRequest.findMany({
      where,
      take: params.limit,
      skip: (params.page - 1) * params.limit,
      orderBy: { created_at: "desc" },
      include: {
        requested_by_user: { select: { id: true, email: true } },
        reviewed_by_user: { select: { id: true, email: true } },
        created_driver: {
          select: { id: true, name: true, phone_no: true, status: true },
        },
      },
    });
    return {
      data: rows,
      pagination: {
        total,
        page: params.page,
        limit: params.limit,
        total_pages: Math.ceil(total / params.limit),
      },
    };
  }

  async update(id: number, data: Driver) {
    await this.getById(id);
    await this.db.driver.update({
      where: { id },
      data: {
        name: data.name,
        phone_no: data.phone_no?.trim() ? data.phone_no.trim() : null,
        address: data.address,
        ...(data.home_lat !== undefined && {
          home_lat: data.home_lat === null ? null : Number(data.home_lat),
        }),
        ...(data.home_long !== undefined && {
          home_long: data.home_long === null ? null : Number(data.home_long),
        }),
        emergency_phone_no: data.emergency_phone_no,
        driver_image_url: data.driver_image_url ?? "",
        rate_per_km:
          data.rate_per_km !== undefined && data.rate_per_km !== null
            ? Number(data.rate_per_km)
            : 0,
        driver_cnic_front_url: data.driver_cnic_front_url ?? "",
        driver_cnic_back_url: data.driver_cnic_back_url ?? "",
        driver_license_front_url: data.driver_license_front_url ?? "",
        driver_license_back_url: data.driver_license_back_url ?? "",
      },
    });

    const shouldUpdateCars =
      data.car_ids !== undefined ||
      data.default_car_id !== undefined ||
      data.car_id !== undefined;
    if (shouldUpdateCars) {
      const existing = await this.db.driverAssignCar.findMany({
        where: { driver_id: id },
        select: { car_id: true, is_default: true },
      });
      const fallbackIds = existing.map((x) => x.car_id);
      const fallbackDefault =
        existing.find((x) => x.is_default)?.car_id ?? fallbackIds[0] ?? null;
      const merged: Driver = {
        ...data,
        car_ids: data.car_ids ?? fallbackIds,
        default_car_id:
          data.default_car_id !== undefined ? data.default_car_id : fallbackDefault,
      };
      const { carIds, defaultCarId } = this.normalizeCars(merged);
      await this.ensureCarsExist(carIds);
      await this.setDriverCars(this.db, id, carIds, defaultCarId);
    }
    return this.getById(id);
  }

  async delete(id: number) {
    await this.getById(id);
    await this.db.driver.delete({ where: { id } });
  }
}
