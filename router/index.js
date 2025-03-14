const router = require("express").Router();
const authRouter = require("./auth");
const home = require("../controller/home");
const invitedUserRouter = require("./invitedUser");
const deviceRouter = require("./device");
const locationRouter = require("./location");

router.use("/auth", authRouter);
router.use("/invite-user", invitedUserRouter);
router.use("/device", deviceRouter);
router.use("/location", locationRouter);

router.get("/ping", home);



module.exports = router;
