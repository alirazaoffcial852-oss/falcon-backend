"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const routeController_1 = require("../../controllers/route/routeController");
const validate_1 = require("../../middleware/validation/validate");
const routeSchema_1 = require("../../schemas/route/routeSchema");
const router = express_1.default.Router();
router.get("/", routeController_1.RouteController.list);
router.get("/:id", validate_1.validate.params(routeSchema_1.routeIdParamSchema), routeController_1.RouteController.getById);
router.post("/", validate_1.validate.body(routeSchema_1.createRouteSchema), routeController_1.RouteController.create);
router.put("/:id", validate_1.validate.combined(routeSchema_1.updateRouteSchema, routeSchema_1.routeIdParamSchema), routeController_1.RouteController.update);
router.delete("/:id", validate_1.validate.params(routeSchema_1.routeIdParamSchema), routeController_1.RouteController.delete);
exports.default = router;
