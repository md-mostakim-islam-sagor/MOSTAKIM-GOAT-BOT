const express = require("express");
const router = express.Router();
const { findUid, getText } = global.utils;

function randomNumberApikey(length) {
        let result = "";
        for (let i = 0; i < length; i++)
                result += Math.floor(Math.random() * 10);
        return result;
}

module.exports = function ({ isAuthenticated, expireVerifyCode, dashBoardData, api, createLimiter, config }) {
        router
                .get("/", isAuthenticated, (req, res) => {
                        req.session.redirectTo = req.query.redirect;
                        res.render("verifyfbid");
                })
                .get("/submit-code", [isAuthenticated, function (req, res, next) {
                        if (!req.session.waitVerify)
                                return res.redirect("/verifyfbid");
                        next();
                }], (req, res) => {
                        res.render("verifyfbid-submit-code");
                })

                .post("/", isAuthenticated, async (req, res) => {
                        const activeApi = global.GoatBot?.fcaApi || api;
                        if (!activeApi)
                                return res.status(400).send({ errors: [{ msg: "Bot is currently offline, please try again later" }] });
                        let { fbid } = req.body;
                        const code = randomNumberApikey(6);
                        if (!fbid)
                                return res.status(400).send({ errors: [{ msg: "Please enter your Facebook ID" }] });
                        try {
                                if (isNaN(fbid))
                                        fbid = await findUid(fbid);
                        }
                        catch (e) {
                                return res.status(400).send({ errors: [{ msg: "Facebook ID or profile URL does not exist" }] });
                        }
                        req.session.waitVerify = {
                                fbid,
                                code,
                                email: req.user.email
                        };

                        setTimeout(() => {
                                delete req.session.waitVerify;
                        }, expireVerifyCode);

                        try {
                                await activeApi.sendMessage(getText("verifyfbid", "sendCode", code, expireVerifyCode / 60000), fbid);
                        }
                        catch (e) {
                                const errors = [];
                                if (e.blockedAction)
                                        errors.push({ msg: "The bot is currently blocked and cannot send messages, please try again later" });
                                else
                                        errors.push({ msg: `Cannot send verification code to Facebook ID "${fbid}". Have you enabled message requests from strangers?` });

                                req.flash("errors", errors);
                                return res.status(400).send({
                                        status: "error",
                                        errors,
                                        message: errors[0].msg
                                });
                        }
                        req.flash("success", { msg: "Verification code sent to your Facebook ID. If not received, check your message requests." });
                        res.send({
                                status: "success",
                                message: "Verification code sent to your Facebook ID. If not received, check your message requests."
                        });
                })
                .post("/submit-code", [isAuthenticated, function (req, res, next) {
                        if (!req.session.waitVerify)
                                return res.redirect("/verifyfbid");
                        next();
                }, createLimiter(1000 * 60 * 5, 20)], async (req, res) => {
                        const { code } = req.body;
                        const user = await dashBoardData.get(req.user.email);
                        if (code == req.session.waitVerify.code) {
                                const fbid = req.session.waitVerify.fbid;
                                console.log(`User ${user.email} verified fbid ${fbid}`);
                                delete req.session.waitVerify;
                                await dashBoardData.set(user.email, { facebookUserID: fbid });
                                req.flash("success", { msg: "Facebook ID verified successfully!" });
                                res.send({
                                        status: "success",
                                        message: "Facebook ID verified successfully!",
                                        redirectLink: req.session.redirectTo || "/dashboard"
                                });
                        }
                        else {
                                return res.status(400).send({ msg: "Verification code is incorrect" });
                        }
                });

        return router;
};
