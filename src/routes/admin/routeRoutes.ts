import express from "express";
import { RouteController } from "../../controllers/route/routeController";
import { validate } from "../../middleware/validation/validate";
import {
	createRouteSchema,
	updateRouteSchema,
	routeIdParamSchema,
	phaseDriverIdParamSchema,
	reassignPhaseDriverBodySchema,
	routeHistoryQuerySchema,
	optionalDayBodySchema,
	generateDailyBodySchema,
	generateDailyPreviewQuerySchema,
	routeActiveStatusBodySchema,
	planStatsQuerySchema,
	listRoutesQuerySchema,
} from "../../schemas/route/routeSchema";

const router = express.Router();

router.post(
	"/phase-drivers/:phaseDriverId/reassign-driver",
	validate.params(phaseDriverIdParamSchema),
	validate.body(reassignPhaseDriverBodySchema),
	RouteController.reassignPhaseDriver,
);

router.get(
	"/history",
	validate.query(routeHistoryQuerySchema),
	RouteController.getHistoryReport,
);
router.get("/", validate.query(listRoutesQuerySchema), RouteController.list);
router.post(
	"/generate-daily",
	validate.body(generateDailyBodySchema),
	RouteController.generateDaily,
);
router.get(
	"/generate-daily/preview",
	validate.query(generateDailyPreviewQuerySchema),
	RouteController.generateDailyPreview,
);
router.post(
	"/:id/spawn",
	validate.combined(optionalDayBodySchema, routeIdParamSchema),
	RouteController.spawnFromTemplate,
);
router.get(
	"/:id/plan-stats",
	validate.params(routeIdParamSchema),
	validate.query(planStatsQuerySchema),
	RouteController.getTemplatePlanStats,
);
router.get(
	"/:id",
	validate.params(routeIdParamSchema),
	RouteController.getById,
);
router.post("/", validate.body(createRouteSchema), RouteController.create);
router.put(
	"/:id",
	validate.combined(updateRouteSchema, routeIdParamSchema),
	RouteController.update,
);
router.patch(
	"/:id/status",
	validate.combined(routeActiveStatusBodySchema, routeIdParamSchema),
	RouteController.setActiveStatus,
);
router.post(
	"/:id/optimize",
	validate.params(routeIdParamSchema),
	RouteController.optimize,
);
router.delete(
	"/:id",
	validate.params(routeIdParamSchema),
	RouteController.delete,
);

export default router;
