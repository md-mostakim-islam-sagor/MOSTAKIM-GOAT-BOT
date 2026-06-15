/**
 * @author MOSTAKIM ISLAM SAGOR
 * ! The source code is written by MOSTAKIM, please don't change the author's name everywhere. Thank you for using
 * ! Official source code: https://github.com/mostakim-sagor/MOSTAKIM-GOAT-BOT-V2.git
 * ! If you do not download the source code from the above address, you are using an unknown version and at risk of having your account hacked
 */

const { spawn } = require("child_process");
const log = require("./mostakim-v2/logger/log.js");

function startProject() {
        const child = spawn("node", ["mostakim.js"], {
                cwd: __dirname,
                stdio: "inherit",
                shell: true
        });

        child.on("close", (code) => {
                if (code == 2) {
                        log.info("Restarting Project...");
                        startProject();
                }
        });
}

startProject();
