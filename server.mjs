import express from "express";
import cors from "cors";
import pg from "pg";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;
const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Connect to PostgreSQL.
// On Render, DATABASE_URL must contain your PostgreSQL connection URL.
if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL environment variable is missing.");
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL
        ? { rejectUnauthorized: false }
        : false
});

pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL pool error:", err);
});

// Only allow the application's known data tables in dynamic queries.
const allowedTables = new Set([
    "back_rub",
    "bathing",
    "bed_mobility_position",
    "bed_mobility_self",
    "bed_mobility_support",
    "bladder",
    "blood_pressure",
    "catheter",
    "denture",
    "dietary_intake",
    "dietary_output",
    "eating_self",
    "eating_support",
    "meal",
    "mood",
    "nails",
    "oral",
    "oxygen_levels",
    "patients",
    "pulse",
    "respiration",
    "shaving",
    "sundowning",
    "temperature",
    "toileting_consistency",
    "toileting_self",
    "toileting_support",
    "transfers_device",
    "transfers_self",
    "transfers_support",
    "users",
    "weight"
]);

function isAllowedTable(tableName) {
    return typeof tableName === "string" &&
        allowedTables.has(tableName);
}

function databaseError(res, message, error, route) {
    console.error(`${route} error:`, error);
    return res.status(500).send({ message });
}

// Check whether a username is already registered.
app.post("/check-username", async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).send({
            exists: false,
            message: "Username required."
        });
    }

    try {
        const result = await pool.query(
            "SELECT username FROM users WHERE username = $1",
            [username]
        );

        return res.send({
            exists: result.rows.length > 0
        });
    } catch (err) {
        return databaseError(
            res, "Database error.", err, "Username check"
        );
    }
});

// Login using username and password.
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send({
            user: false,
            message: "Username and password are required."
        });
    }

    try {
        const result = await pool.query(
            `SELECT username, is_administrator, password_hash
             FROM users
             WHERE username = $1`,
            [username]
        );

        if (
            result.rows.length === 0 ||
            !result.rows[0].password_hash
        ) {
            return res.send({
                user: false,
                message: "Invalid username or password."
            });
        }

        const user = result.rows[0];

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.send({
                user: false,
                message: "Invalid username or password."
            });
        }

        await pool.query(
            "UPDATE users SET logged_in = 1 WHERE username = $1",
            [username]
        );

        return res.send({
            user: true,
            admin: Number(user.is_administrator)
        });
    } catch (err) {
        return databaseError(
            res, "Server error.", err, "Login"
        );
    }
});

// Logout.
app.post("/logout", async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).send({
            success: false,
            message: "Username required."
        });
    }

    try {
        await pool.query(
            "UPDATE users SET logged_in = 0 WHERE username = $1",
            [username]
        );

        return res.send({ success: true });
    } catch (err) {
        console.error("Logout error:", err);
        return res.status(500).send({ success: false });
    }
});

// Create an account and hash its password.
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

        await pool.query(
            `INSERT INTO users
                (is_administrator, first_name, last_name,
                 username, password_hash, logged_in)
             VALUES ($1, $2, $3, $4, $5, 1)`,
            [
                Number(admin),
                firstName,
                lastName,
                username,
                passwordHash
            ]
        );

        return res.status(201).send({
            success: true,
            username,
            admin: Number(admin)
        });
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).send({
                success: false,
                message: "This username already exists."
            });
        }

        return databaseError(
            res,
            "Could not create account.",
            err,
            "Signup"
        );
    }
});

// Get patients.
app.get("/getPatients", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM patients");
        return res.send(result.rows);
    } catch (err) {
        return databaseError(
            res, "Database error.", err, "getPatients"
        );
    }
});

// Submit a value.
app.post("/submit", async (req, res) => {
    const { username, patientId, value, tableName } = req.body;

    if (!isAllowedTable(tableName) || tableName === "users") {
        return res.status(400).send({
            message: "Invalid table name."
        });
    }

    try {
        await pool.query(
            `INSERT INTO "${tableName}"
                (username, patient_id, value)
             VALUES ($1, $2, $3)`,
            [username, patientId, value]
        );

        return res.send({ success: true });
    } catch (err) {
        return databaseError(
            res, "Could not save data.", err, "Submit"
        );
    }
});

// Teacher report.
app.post("/teacher", async (req, res) => {
    const { tableName, username, date1, date2 } = req.body;

    if (!isAllowedTable(tableName) || tableName === "users") {
        return res.status(400).send({
            message: "Invalid table name."
        });
    }

    try {
        const result = await pool.query(
            `SELECT *
             FROM "${tableName}"
             WHERE username = $1
               AND DATE(date) >= $2
               AND DATE(date) <= $3`,
            [username, date1, date2]
        );

        return res.send(result.rows);
    } catch (err) {
        return databaseError(
            res, "Database error.", err, "Teacher report"
        );
    }
});

// Get students.
app.post("/getStudents", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT *
             FROM users
             WHERE is_administrator = 0
             ORDER BY last_name`
        );

        return res.send(result.rows);
    } catch (err) {
        return databaseError(
            res, "Database error.", err, "getStudents"
        );
    }
});

// Submit two values.
app.post("/twoValues", async (req, res) => {
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
        !isAllowedTable(tableName) ||
        tableName === "users" ||
        !validIdentifier.test(colName1 || "") ||
        !validIdentifier.test(colName2 || "")
    ) {
        return res.status(400).send({
            message: "Invalid table or column name."
        });
    }

    try {
        await pool.query(
            `INSERT INTO "${tableName}"
                (username, patient_id, "${colName1}", "${colName2}")
             VALUES ($1, $2, $3, $4)`,
            [username, patientId, val1, val2]
        );

        return res.send({ success: true });
    } catch (err) {
        return databaseError(
            res, "Could not save data.", err, "twoValues"
        );
    }
});

// Legacy endpoint: returns a password hash.
// Avoid using this endpoint from browser code; password verification
// should happen through /login on the server.
app.post("/getHash", async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).send({
            message: "Username required."
        });
    }

    try {
        const result = await pool.query(
            "SELECT password_hash FROM users WHERE username = $1",
            [username]
        );

        return res.send(result.rows);
    } catch (err) {
        return databaseError(
            res, "Database error.", err, "getHash"
        );
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});