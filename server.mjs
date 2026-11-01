import express from "express";
import cors from "cors";
import mariadb from "mariadb/callback.js";
import bcrypt from "bcrypt";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

const db_info = {
    host: "127.0.0.1",
    user: "db_user",
    password: "HA-db",
    database: "health_assisting"
};

const conn = mariadb.createConnection(db_info);

// Check whether a username is already registered
app.post("/check-username", (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).send({ exists: false, message: "Username required." });
    }

    conn.query(
        "SELECT username FROM users WHERE username = ?",
        [username],
        (err, rows) => {
            if (err) {
                console.error("Username check error:", err);
                return res.status(500).send({ message: "Database error." });
            }

            return res.send({ exists: rows.length > 0 });
        }
    );
});

// Login using username and password
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send({
            user: false,
            message: "Username and password are required."
        });
    }

    conn.query(
        "SELECT username, is_administrator, password_hash FROM users WHERE username = ?",
        [username],
        async (err, rows) => {
            if (err) {
                console.error("Login database error:", err);
                return res.status(500).send({
                    user: false,
                    message: "Server error."
                });
            }

            if (!rows || rows.length === 0 || !rows[0].password_hash) {
                return res.send({
                    user: false,
                    message: "Invalid username or password. Existing accounts may need a password reset."
                });
            }

            try {
                const passwordMatches = await bcrypt.compare(
                    password,
                    rows[0].password_hash
                );

                if (!passwordMatches) {
                    return res.send({
                        user: false,
                        message: "Invalid username or password."
                    });
                }

                conn.query(
                    "UPDATE users SET logged_in = 1 WHERE username = ?",
                    [username],
                    (updateErr) => {
                        if (updateErr) {
                            console.error("Login status update error:", updateErr);
                            return res.status(500).send({
                                user: false,
                                message: "Could not complete login."
                            });
                        }

                        return res.send({
                            user: true,
                            admin: Number(rows[0].is_administrator)
                        });
                    }
                );
            } catch (error) {
                console.error("Password verification error:", error);
                return res.status(500).send({
                    user: false,
                    message: "Server error."
                });
            }
        }
    );
});

// Logout
app.post("/logout", (req, res) => {
    const { username } = req.body;

    conn.query(
        "UPDATE users SET logged_in = 0 WHERE username = ?",
        [username],
        (err) => {
            if (err) {
                console.error("Logout error:", err);
                return res.status(500).send({ success: false });
            }

            return res.send({ success: true });
        }
    );
});

// Create an account and hash its password
app.post("/signup", async (req, res) => {
    const { username, password, firstName, lastName, admin } = req.body;

    if (
        !username ||
        !password ||
        !firstName ||
        !lastName ||
        ![0, 1].includes(Number(admin))
    ) {
        return res.status(400).send({
            success: false,
            message: "Please provide all required fields."
        });
    }

    if (password.length < 8) {
        return res.status(400).send({
            success: false,
            message: "Password must be at least 8 characters."
        });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);

        conn.query(
            `INSERT INTO users
             (is_administrator, first_name, last_name, username, password_hash, logged_in)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [
                Number(admin),
                firstName,
                lastName,
                username,
                passwordHash
            ],
            (err) => {
                if (err) {
                    if (err.code === "ER_DUP_ENTRY") {
                        return res.status(409).send({
                            success: false,
                            message: "This username already exists."
                        });
                    }

                    console.error("Signup database error:", err);
                    return res.status(500).send({
                        success: false,
                        message: "Could not create account."
                    });
                }

                return res.status(201).send({
                    success: true,
                    username,
                    admin: Number(admin)
                });
            }
        );
    } catch (error) {
        console.error("Signup error:", error);
        return res.status(500).send({
            success: false,
            message: "Could not create account."
        });
    }
});

// Get patients
app.get("/getPatients", (req, res) => {
    conn.query("SELECT * FROM patients", (err, rows) => {
        if (err) {
            console.error("getPatients error:", err);
            return res.status(500).send({ message: "Database error." });
        }

        res.send(rows);
    });
});

// Submit a value
app.post("/submit", (req, res) => {
    const { username, patientId, value, tableName } = req.body;

    // Table names cannot be safely supplied as SQL parameters.
    // Validate them before using them in a query.
    if (!/^[a-zA-Z0-9_]+$/.test(tableName || "")) {
        return res.status(400).send({ message: "Invalid table name." });
    }

    conn.query(
        `INSERT INTO \`${tableName}\` (username, patient_id, value) VALUES (?, ?, ?)`,
        [username, patientId, value],
        (err) => {
            if (err) {
                console.error("Submit error:", err);
                return res.status(500).send({ message: "Could not save data." });
            }

            res.send({ success: true });
        }
    );
});

// Teacher report
app.post("/teacher", (req, res) => {
    const { tableName, username, date1, date2 } = req.body;

    if (!/^[a-zA-Z0-9_]+$/.test(tableName || "")) {
        return res.status(400).send({ message: "Invalid table name." });
    }

    conn.query(
        `SELECT * FROM \`${tableName}\`
         WHERE username = ?
         AND DATE(date) >= ?
         AND DATE(date) <= ?`,
        [username, date1, date2],
        (err, rows) => {
            if (err) {
                console.error("Teacher report error:", err);
                return res.status(500).send({ message: "Database error." });
            }

            res.send(rows);
        }
    );
});

// Get students
app.post("/getStudents", (req, res) => {
    conn.query(
        "SELECT * FROM users WHERE is_administrator = 0 ORDER BY last_name",
        (err, rows) => {
            if (err) {
                console.error("getStudents error:", err);
                return res.status(500).send({ message: "Database error." });
            }

            res.send(rows);
        }
    );
});

// Submit two values
app.post("/twoValues", (req, res) => {
    const {
        username,
        patientId,
        val1,
        val2,
        tableName,
        colName1,
        colName2
    } = req.body;

    const validIdentifier = /^[a-zA-Z0-9_]+$/;

    if (
        !validIdentifier.test(tableName || "") ||
        !validIdentifier.test(colName1 || "") ||
        !validIdentifier.test(colName2 || "")
    ) {
        return res.status(400).send({ message: "Invalid table or column name." });
    }

    conn.query(
        `INSERT INTO \`${tableName}\`
         (username, patient_id, \`${colName1}\`, \`${colName2}\`)
         VALUES (?, ?, ?, ?)`,
        [username, patientId, val1, val2],
        (err) => {
            if (err) {
                console.error("twoValues error:", err);
                return res.status(500).send({ message: "Could not save data." });
            }

            res.send({ success: true });
        }
    );
});

// Get a password hash if another part of the application needs it.
// Never send password hashes to the browser for login verification.
app.post("/getHash", (req, res) => {
    const { username } = req.body;

    conn.query(
        "SELECT password_hash FROM users WHERE username = ?",
        [username],
        (err, rows) => {
            if (err) {
                console.error("getHash error:", err);
                return res.status(500).send({ message: "Database error." });
            }

            res.send(rows);
        }
    );
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});