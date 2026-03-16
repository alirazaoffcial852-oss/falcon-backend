import express from "express";
import { RouteController } from "../../controllers/route/routeController";
import { validate } from "../../middleware/validation/validate";
import {
	createRouteSchema,
	updateRouteSchema,
	routeIdParamSchema,
} from "../../schemas/route/routeSchema";

const router = express.Router();

router.get("/", RouteController.list);
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
router.delete(
	"/:id",
	validate.params(routeIdParamSchema),
	RouteController.delete,
);

export default router;
