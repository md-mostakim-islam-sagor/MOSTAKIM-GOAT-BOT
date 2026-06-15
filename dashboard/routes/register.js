const bcrypt = require("bcrypt");
const expres = require("express");
const router = expres.Router();

function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = function ({
        unAuthenticated, isWaitVerifyAccount,
        generateEmailVerificationCode, dashBoardData, expireVerifyCode
}) {
        router
                .get("/", unAuthenticated, (req, res) => {
                        res.render("register");
                })
                .get("/submit-code", [unAuthenticated, isWaitVerifyAccount], (req, res) => {
                        res.render("register-submit-code");
                })
                .get("/resend-code", [unAuthenticated, isWaitVerifyAccount], async (req, res) => {
                        res.render("register-resend-code");
                })

                .post("/", unAuthenticated, async (req, res) => {
                        try {
                                const { name, email, password, password_confirmation } = req.body;
                                const errors = [];
                                if (!name || !email || !password || !password_confirmation)
                                        errors.push({ msg: "Please fill in all required fields" });
                                if (email && !validateEmail(email))
                                        errors.push({ msg: "Invalid email address" });
                                if (email && (email.length > 100 || email.length < 5))
                                        errors.push({ msg: "Email must be between 5 and 100 characters" });
                                if (email && await dashBoardData.get(email))
                                        errors.push({ msg: `Email address ${email} is already in use` });
                                if (password && password_confirmation && password !== password_confirmation)
                                        errors.push({ msg: "Passwords do not match" });
                                if (password && password.length < 6)
                                        errors.push({ msg: "Password must be at least 6 characters" });
                                if (errors.length > 0) {
                                        return res.status(400).send({
                                                status: "error",
                                                errors
                                        });
                                }

                                const hashPassword = bcrypt.hashSync(password, 10);
                                const userData = {
                                        email,
                                        name,
                                        password: hashPassword
                                };

                                const user = await dashBoardData.create(userData);
                                const redirectLink = req.session.redirectTo || "/";

                                req.logIn(user, (err) => {
                                        if (err) {
                                                return res.status(500).send({
                                                        status: "error",
                                                        errors: [{ msg: "Registration failed, please try again" }]
                                                });
                                        }
                                        delete req.session.redirectTo;
                                        res.send({ redirectLink });
                                });
                        } catch (err) {
                                return res.status(500).send({
                                        status: "error",
                                        errors: [{ msg: "An error occurred: " + err.message }]
                                });
                        }
                });

        return router;
};
