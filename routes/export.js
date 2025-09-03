// routes/export.js
const express = require("express");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDateISO(d) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function flattenInspection(row, deliveryMenMap) {
  const consumer = row.consumer || {};
  const deliveryName = row.deliveryManName || row?.deliveryManId?.name || deliveryMenMap[row.deliveryManId] || "";

  const safetyQuestions = row.safetyQuestions || [];
  const safetyCols = {};
  safetyQuestions.forEach((q) => {
    const key = `Q${Number(q.questionId ?? 0) + 1}`;
    safetyCols[key] = q.answer ?? "";
  });

  const productsArr = row.products || [];
  const productsSummary = productsArr
    .map((p) => {
      const name = p.name || p?.productId?.name || "Item";
      const qty = p.quantity ?? 1;
      const price = p.price ?? "";
      return `${name} x ${qty}${price !== "" ? ` @ ${price}` : ""}`;
    })
    .join(" | ");

  const imagesCount = Array.isArray(row.images) ? row.images.length : 0;

  return {
    InspectionID: row.inspectionId || row.id || row._id || "",
    Date: formatDateISO(row.inspectionDate || row.date),
    Distributor: row?.distributorId?.agencyName || "",
    DeliveryMan: deliveryName,
    ConsumerName: row.consumerName || consumer.name || "",
    ConsumerNumber: row.consumerNumber || consumer.consumerNumber || "",
    Mobile: row.mobileNumber || consumer.mobileNumber || "",
    Address: row.address || consumer.address || "",
    SurakshaHoseDueDate: row.surakshaHoseDueDate || "",
    HotplateExchange: row.hotplateExchange ? "Yes" : "No",
    OtherDiscount: row.otherDiscount ?? "",
    SubtotalAmount: row.subtotalAmount ?? "",
    TotalDiscount: row.totalDiscount ?? "",
    TotalAmount: row.totalAmount ?? "",
    PassedQuestions: row.passedQuestions ?? "",
    FailedQuestions: row.failedQuestions ?? "",
    ImagesCount: imagesCount,
    Products: productsSummary,
    Latitude: row.location?.latitude ?? "",
    Longitude: row.location?.longitude ?? "",
    ...safetyCols,
  };
}

function buildCSV(rows) {
  if (!rows.length) return "";
  const allHeaders = new Set();
  rows.forEach((r) => Object.keys(r).forEach((k) => allHeaders.add(k)));
  const headers = Array.from(allHeaders);

  const lines = [];
  lines.push(`# LPG Inspection Export`);
  lines.push(`# Generated: ${new Date().toLocaleString()}`);
  lines.push(`# Total Records: ${rows.length}`);
  lines.push("");
  lines.push(headers.join(","));
  rows.forEach((r) => {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  });
  return lines.join("\n");
}

// Route for mobile apps to send data and get download URL
router.post("/csv", authenticateToken, async (req, res) => {
  try {
    const { inspections, deliveryMen, fileName = "inspections_export" } = req.body;

    if (!Array.isArray(inspections) || inspections.length === 0) {
      return res.status(400).json({ error: "No inspections provided" });
    }

    // Map delivery men for quick lookup
    const deliveryMap = {};
    (Array.isArray(deliveryMen) ? deliveryMen : []).forEach((dm) => {
      const id = dm._id || dm.id;
      if (id) deliveryMap[id] = dm.name || "";
    });

    // Flatten rows
    const flatRows = inspections.map((row) => flattenInspection(row, deliveryMap));
    const csv = buildCSV(flatRows);

    // Store temporarily (you might want to use Redis or a temp file)
    const exportId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Option 1: Store in memory (simple but not scalable)
    global.tempExports = global.tempExports || {};
    global.tempExports[exportId] = {
      csv,
      fileName,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    };

    // Clean up old exports
    Object.keys(global.tempExports).forEach(id => {
      if (global.tempExports[id].expiresAt < new Date()) {
        delete global.tempExports[id];
      }
    });

    const downloadUrl = `${req.protocol}://${req.get('host')}/api/export/download/${exportId}`;

    res.json({
      success: true,
      exportId,
      downloadUrl,
      recordCount: flatRows.length,
      expiresAt: global.tempExports[exportId].expiresAt,
    });

  } catch (error) {
    console.error("CSV export error:", error);
    res.status(500).json({ error: "Failed to create export" });
  }
});

// Download route that serves the CSV file
router.get("/download/:exportId", (req, res) => {
  try {
    const { exportId } = req.params;
    
    if (!global.tempExports || !global.tempExports[exportId]) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Export Not Found</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>Export Not Found</h2>
          <p>This export link has expired or doesn't exist.</p>
          <p>Please generate a new export from the app.</p>
        </body>
        </html>
      `);
    }

    const exportData = global.tempExports[exportId];
    
    if (exportData.expiresAt < new Date()) {
      delete global.tempExports[exportId];
      return res.status(410).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Export Expired</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>Export Expired</h2>
          <p>This export link has expired.</p>
          <p>Please generate a new export from the app.</p>
        </body>
        </html>
      `);
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${exportData.fileName}.csv"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Send the CSV content
    res.send(exportData.csv);

    // Clean up after download
    setTimeout(() => {
      if (global.tempExports && global.tempExports[exportId]) {
        delete global.tempExports[exportId];
      }
    }, 5000);

  } catch (error) {
    console.error("Download error:", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Download Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h2>Download Error</h2>
        <p>There was an error preparing your download.</p>
        <p>Please try generating a new export from the app.</p>
      </body>
      </html>
    `);
  }
});

// Route for URL-encoded data (smaller datasets)
router.get("/csv", (req, res) => {
  try {
    const { data } = req.query;
    
    if (!data) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>No Data</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>No Export Data</h2>
          <p>No data was provided for export.</p>
        </body>
        </html>
      `);
    }

    try {
      const decodedData = JSON.parse(atob(decodeURIComponent(data)));
      const csv = buildCSV(decodedData.rows);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${decodedData.fileName}.csv"`);
      res.send(csv);
      
    } catch (parseError) {
      throw new Error("Invalid data format");
    }

  } catch (error) {
    console.error("CSV export error:", error);
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Export Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h2>Export Error</h2>
        <p>There was an error processing your export data.</p>
        <p>Please try again from the app.</p>
      </body>
      </html>
    `);
  }
});

module.exports = router;