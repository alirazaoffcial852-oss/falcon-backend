import express from "express";
import { ScheduleController } from "../../controllers/schedule/scheduleController";
import { validate } from "../../middleware/validation/validate";
import {
	companyIdParamSchema,
	driverIdParamSchema,
	scheduleIdParamSchema,
	companyHolidayBodySchema,
	driverLeaveBodySchema,
} from "../../schemas/schedule/scheduleSchema";

const router = express.Router();

router.get(
	"/companies/:companyId/holidays",
	validate.params(companyIdParamSchema),
	ScheduleController.listCompanyHolidays,
);
router.post(
	"/companies/:companyId/holidays",
	validate.combined(companyHolidayBodySchema, companyIdParamSchema),
	ScheduleController.addCompanyHoliday,
);
router.delete(
	"/company-holidays/:id",
	validate.params(scheduleIdParamSchema),
	ScheduleController.removeCompanyHoliday,
);

router.get(
	"/drivers/:driverId/leaves",
	validate.params(driverIdParamSchema),
	ScheduleController.listDriverLeaves,
);
router.post(
	"/drivers/:driverId/leaves",
	validate.combined(driverLeaveBodySchema, driverIdParamSchema),
	ScheduleController.addDriverLeave,
);
router.delete(
	"/driver-leaves/:id",
	validate.params(scheduleIdParamSchema),
	ScheduleController.removeDriverLeave,
);

export default router;
