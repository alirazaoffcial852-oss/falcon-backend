import express from "express";
import { ScheduleController } from "../../controllers/schedule/scheduleController";
import { validate } from "../../middleware/validation/validate";
import {
	companyIdParamSchema,
	driverIdParamSchema,
	scheduleIdParamSchema,
	companyHolidayBodySchema,
	updateCompanyHolidayBodySchema,
	driverLeaveBodySchema,
	driverLeaveRangeQuerySchema,
} from "../../schemas/schedule/scheduleSchema";
import { roleMiddleware } from "../../middleware/authMiddleware";

const router = express.Router();

router.get(
	"/companies/:companyId/holidays",
	roleMiddleware("admin"),
	validate.params(companyIdParamSchema),
	ScheduleController.listCompanyHolidays,
);
router.post(
	"/companies/:companyId/holidays",
	roleMiddleware("admin"),
	validate.combined(companyHolidayBodySchema, companyIdParamSchema),
	ScheduleController.addCompanyHoliday,
);
router.delete(
	"/company-holidays/:id",
	roleMiddleware("admin"),
	validate.params(scheduleIdParamSchema),
	ScheduleController.removeCompanyHoliday,
);
router.get(
	"/company-holidays/:id",
	roleMiddleware("admin"),
	validate.params(scheduleIdParamSchema),
	ScheduleController.getCompanyHolidayById,
);
router.put(
	"/company-holidays/:id",
	roleMiddleware("admin"),
	validate.combined(updateCompanyHolidayBodySchema, scheduleIdParamSchema),
	ScheduleController.updateCompanyHoliday,
);

router.get(
	"/drivers/:driverId/leaves",
	roleMiddleware("admin"),
	validate.params(driverIdParamSchema),
	validate.query(driverLeaveRangeQuerySchema),
	ScheduleController.listDriverLeaves,
);
router.post(
	"/drivers/:driverId/leaves",
	roleMiddleware("admin", "driver"),
	validate.combined(driverLeaveBodySchema, driverIdParamSchema),
	ScheduleController.addDriverLeave,
);
router.delete(
	"/driver-leaves/:id",
	roleMiddleware("admin"),
	validate.params(scheduleIdParamSchema),
	ScheduleController.removeDriverLeave,
);

export default router;
