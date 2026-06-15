const bcrypt = require("bcrypt");
const expres = require("express");
const router = expres.Router();

function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = function ({ unAuthenticated, generateEmailVerificationCode, expireVerifyCode, dashBoardData }) {
        router
                .get("/", unAuthenticated, (req, res) => {
                        res.render("forgot-password");
                })
                .get("/submit-code", unAuthenticated, (req, res) => {
                        if (!req.session.resetPassword)
                                return res.redirect("/forgot-password");
                        res.render("forgot-password-submit-code");
                })
                .get("/new-password", unAuthenticated, (req, res) => {
                        if (!req.session.resetPassword)
                                return res.redirect("/forgot-password");
                        res.render("forgot-password-new-password");
                })

                .post("/", unAuthenticated, async (req, res) => {
                        const { email } = req.body;
                        if (!validateEmail(email)) {
                                req.flash("errors", { msg: "Invalid email address" });
                                return res.redirect("/forgot-password");
                        }
                        const user = await dashBoardData.get(email);
                        if (!user) {
                                req.flash("errors", { msg: "Email not found" });
                                return res.redirect("/forgot-password");
                        }

                        const code = Math.floor(100000 + Math.random() * 900000).toString();
                        req.session.resetPassword = { email, code };

                        let emailSent = false;
                        try {
                                const nodemailer = require("nodemailer");
                                const smtpUser = process.env.SMTP_USER;
                                const smtpPass = process.env.SMTP_PASS;
                                const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
                                const smtpPort = parseInt(process.env.SMTP_PORT) || 587;

                                if (smtpUser && smtpPass) {
                                        const transporter = nodemailer.createTransport({
                                                host: smtpHost,
                                                port: smtpPort,
                                                secure: smtpPort === 465,
                                                auth: { user: smtpUser, pass: smtpPass }
                                        });
                                        await transporter.sendMail({
                                                from: smtpUser,
                                                to: email,
                                                subject: "Reset your password - MOSTAKIM GOAT BOT",
                                                html: generateEmailVerificationCode(code, "You requested a password reset. Your verification code is below.")
                                        });
                                        emailSent = true;
                                }
                        } catch (e) {
                                console.error("Email send failed:", e.message);
                        }

                        if (!emailSent) {
                                console.log(`[ForgotPassword] Reset code for ${email}: ${code}`);
                        }

                        res.redirect("/forgot-password/submit-code");
                        setTimeout((() => {
                                if (req.session.resetPassword)
                                        delete req.session.resetPassword.code;
                        }), expireVerifyCode);
                })
                .post("/submit-code", unAuthenticated, async (req, res) => {
                        const { code } = req.body;
                        const { resetPassword } = req.session;
                        if (!resetPassword)
                                return res.redirect("/forgot-password");
                        if (code !== resetPassword.code) {
                                req.flash("errors", { msg: "Verification code is incorrect" });
                                return res.redirect("/forgot-password/submit-code");
                        }
                        res.redirect("/forgot-password/new-password");
                })
                .post("/new-password", unAuthenticated, async (req, res) => {
                        if (!req.session.resetPassword)
                                return res.redirect("/forgot-password");
                        const email = req.session.resetPassword.email;
                        const { password, password_confirmation } = req.body;
                        if (password !== password_confirmation) {
                                req.flash("errors", { msg: "Passwords do not match" });
                                return res.redirect("/forgot-password/new-password");
                        }
                        if (password.length < 6) {
                                req.flash("errors", { msg: "Password must be at least 6 characters" });
                                return res.redirect("/forgot-password/new-password");
                        }
                        const hashPassword = bcrypt.hashSync(password, 10);
                        await dashBoardData.set(email, { password: hashPassword });
                        delete req.session.resetPassword;
                        req.flash("success", { msg: "Password changed successfully!" });
                        res.redirect("/login");
                });

        return router;
};
