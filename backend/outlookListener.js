import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;

// ===== PostgreSQL Connection =====
const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false },
});

// ===== Helper: Normalize statuses between email and DB =====
const normalizeStatus = (rawStatus) => {
  const map = {
    OPEN: "Open",
    CLOSED: "Closed",
    ON_HOLD: "On Hold",
    FILLED: "Filled",
    CANCELLED: "Cancelled",
  };
  return map[rawStatus?.trim().toUpperCase()] || "Open";
};

// ===== Initialize Microsoft Graph Client =====
let client;
export const initGraphClient = (accessToken) => {
  client = Client.init({
    authProvider: (done) => done(null, accessToken),
  });
};

// ===== Parse email text =====
const parseEmailBody = (body) => {
  const refMatch = body.match(/Optional Ref #:\s*(\d+)/i);
  const fromMatch = body.match(/FROM\s+([A-Z_]+)/i);
  const toMatch = body.match(/TO\s+([A-Z_]+)/i);

  if (!refMatch || !toMatch) return null;

  return {
    reqId: refMatch[1],
    newStatus: normalizeStatus(toMatch[1]),
    oldStatus: normalizeStatus(fromMatch ? fromMatch[1] : ""),
  };
};

// ===== Poll Outlook for recent emails =====
export const checkEmails = async (io) => {
  if (!client) {
    console.error("❌ Graph client not initialized");
    return;
  }

  try {
    const messages = await client
      .api("/me/mailFolders/inbox/messages")
      .top(10)
      .orderby("receivedDateTime DESC")
      .get();

    for (const msg of messages.value) {
      const subject = msg.subject || "";
      const bodyText = msg.body?.content || "";

      if (!/Job Updated/i.test(subject)) continue;

      const parsed = parseEmailBody(bodyText);
      if (!parsed) continue;

      const { reqId, newStatus, oldStatus } = parsed;

      console.log(`📨 Email detected for Req #${reqId}: ${oldStatus} → ${newStatus}`);

      // ===== Update DB =====
      const clientConn = await pool.connect();
      try {
        // If not found, skip
        const existing = await clientConn.query(
          "SELECT * FROM requisitions WHERE requirementid = $1",
          [reqId]
        );
        if (!existing.rows.length) {
          console.warn(`⚠️ Requirement ${reqId} not found in DB`);
          continue;
        }

        let query, values;

        // If new status is NOT "Open", clear recruiters and working times
        if (newStatus !== "Open") {
          query = `
            UPDATE requisitions
            SET status = $1,
                assigned_recruiters = '{}',
                working_times = '{}',
                createdat = NOW()
            WHERE requirementid = $2
            RETURNING *;
          `;
          values = [newStatus, reqId];
        } else {
          query = `
            UPDATE requisitions
            SET status = $1,
                createdat = NOW()
            WHERE requirementid = $2
            RETURNING *;
          `;
          values = [newStatus, reqId];
        }

        const { rows } = await clientConn.query(query, values);
        const updatedRow = rows[0];

        if (updatedRow) {
          console.log(`✅ Requirement ${reqId} updated → ${newStatus}`);
          io.emit("requisitions_updated", updatedRow); // Broadcast in real-time
        }
      } catch (err) {
        console.error("❌ Error updating DB from email:", err);
      } finally {
        clientConn.release();
      }
    }
  } catch (err) {
    console.error("❌ Error fetching emails from Outlook:", err);
  }
};
